import React from 'react';

/* ── SVG visuals ─────────────────────────────────── */
export const mathSVGGeom = (
  <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
    <circle cx="40" cy="40" r="28" stroke="#001161" strokeWidth="2.5" strokeDasharray="5 3" opacity="0.3"/>
    <line x1="12" y1="40" x2="68" y2="40" stroke="#001161" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
    <line x1="40" y1="12" x2="40" y2="68" stroke="#001161" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
    <circle cx="40" cy="40" r="4" fill="#FF6B1A"/>
    <line x1="40" y1="40" x2="62" y2="22" stroke="#FF6B1A" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="62" cy="22" r="3" fill="#FF6B1A"/>
    <path d="M14 62 L30 44 L46 54 L62 34" stroke="#001161" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
  </svg>
);

export const mathSVGAlgebra = (
  <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
    <rect x="8" y="18" width="64" height="14" rx="7" fill="#001161" opacity="0.08"/>
    <text x="40" y="29" textAnchor="middle" fontSize="11" fill="#001161" fontFamily="sans-serif" fontWeight="bold">2x + 5 = 13</text>
    <rect x="8" y="38" width="64" height="14" rx="7" fill="#FF6B1A" opacity="0.12"/>
    <text x="40" y="49" textAnchor="middle" fontSize="11" fill="#FF6B1A" fontFamily="sans-serif" fontWeight="bold">x = 4 ✓</text>
    <circle cx="20" cy="68" r="5" fill="#001161" opacity="0.1"/>
    <circle cx="40" cy="68" r="5" fill="#FF6B1A" opacity="0.6"/>
    <circle cx="60" cy="68" r="5" fill="#001161" opacity="0.1"/>
  </svg>
);

export const mathSVGStats = (
  <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
    <rect x="10" y="50" width="10" height="20" rx="3" fill="#001161" opacity="0.5"/>
    <rect x="25" y="35" width="10" height="35" rx="3" fill="#001161" opacity="0.6"/>
    <rect x="40" y="20" width="10" height="50" rx="3" fill="#FF6B1A"/>
    <rect x="55" y="40" width="10" height="30" rx="3" fill="#001161" opacity="0.4"/>
    <line x1="5" y1="70" x2="75" y2="70" stroke="#001161" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
  </svg>
);

export const mathSVG3D = (
  <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
    <path d="M40 10 L68 28 L68 58 L40 70 L12 58 L12 28 Z" stroke="#001161" strokeWidth="2.5" fill="none" opacity="0.4"/>
    <path d="M40 10 L40 70" stroke="#001161" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3"/>
    <path d="M12 28 L68 28" stroke="#001161" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3"/>
    <circle cx="40" cy="40" r="6" fill="#FF6B1A" opacity="0.8"/>
    <path d="M40 40 L62 28" stroke="#FF6B1A" strokeWidth="2" strokeLinecap="round"/>
    <path d="M40 40 L18 28" stroke="#FF6B1A" strokeWidth="2" strokeLinecap="round"/>
    <path d="M40 40 L40 12" stroke="#FF6B1A" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const mathSVGFeedback = (
  <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
    <circle cx="40" cy="36" r="22" fill="white" stroke="#001161" strokeWidth="2.5"/>
    <path d="M28 36 L36 44 L52 28" stroke="#FF6B1A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="40" cy="36" r="28" stroke="#FF6B1A" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3"/>
    <text x="40" y="72" textAnchor="middle" fontSize="9" fill="#001161" fontFamily="sans-serif" opacity="0.5">{'Spr\u00e1vn\u011b!'}</text>
  </svg>
);

export const mathSVGRVP = (
  <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
    <rect x="10" y="10" width="60" height="60" rx="10" fill="white" stroke="#001161" strokeWidth="2"/>
    <rect x="10" y="10" width="60" height="20" rx="10" fill="#001161" opacity="0.8"/>
    <rect x="10" y="22" width="60" height="8" fill="#001161" opacity="0.8"/>
    <text x="40" y="24" textAnchor="middle" fontSize="8" fill="white" fontFamily="sans-serif" fontWeight="bold">RVP 2025</text>
    <rect x="18" y="38" width="32" height="3" rx="1.5" fill="#001161" opacity="0.2"/>
    <rect x="18" y="45" width="44" height="3" rx="1.5" fill="#001161" opacity="0.2"/>
    <rect x="18" y="52" width="38" height="3" rx="1.5" fill="#001161" opacity="0.2"/>
    <circle cx="58" cy="58" r="10" fill="#FF6B1A"/>
    <path d="M54 58 L57 61 L62 55" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ── Types ────────────────────────────────────────── */
export interface Topic { label: string; color: string; emoji: string }
export interface Feature { title: string; desc: string; color: string; visual: React.ReactNode }
export interface SubjectConfig {
  displayName: string;
  /** 2. pád názvu předmětu (např. webináře: „Webináře Přírodopisu“). */
  displayNameGenitive: string;
  /** „naše“ / „náš“ před názvem předmětu v rozklikávací větě (rod). */
  heroTeaserOurWord: 'na\u0161e' | 'n\u00e1\u0161';
  tagline: string;
  heroColor: string;
  heroColorDark: string;
  accentColor: string;
  grades: string[];
  /** Řádek vedle odznaků RVP/MŠMT (např. „pro 6. – 9. ročník“). Matematiku podle URL řeší SubjectPage. */
  heroRocnikLine?: string;
  stats: { value: string; label: string }[];
  features: Feature[];
  topics: { grade: string; items: Topic[] }[];
  rvpNote: string;
  dolozka?: string;
  /** Pod názvem předmětu: nadpis úvodu autora (editovatelné v adminu Předměty). */
  authorIntroHeading?: string;
  /** Text úvodu autora pod nadpisem (plain text, zalamování řádků). */
  authorIntroBody?: string;
  /** Jeden blok (operátor): přepíše pár authorIntro*; viz parseHeroText. */
  heroText?: string;
}

/* ── Configs ──────────────────────────────────────── */
export const SUBJECT_CONFIGS: Record<string, SubjectConfig> = {
  'Matematika': {
    displayName: 'Matematika',
    displayNameGenitive: 'Matematiky',
    heroTeaserOurWord: 'na\u0161e',
    tagline: 'Od z\u00e1klad\u016f po funkce \u2014 interaktivn\u011b, srozumiteln\u011b, modern\u011b.',
    heroColor: '#e8f0fb',
    heroColorDark: '#b8d4f5',
    accentColor: '#4a7fd4',
    grades: ['2. stupe\u0148', '1. stupe\u0148'],
    /* heroRocnikLine: dynamicky podle Matematika 1./2. stupeň v SubjectPage */
    stats: [
      { value: '30+', label: 'se\u0161it\u016f a u\u010debnic' },
      { value: '6', label: 'ro\u010dn\u00edk\u016f' },
      { value: '1200+', label: 'interaktivn\u00edch aktivit' },
      { value: 'M\u0160MT', label: 'd\u016fle\u017eka schv\u00e1len\u00ed' },
    ],
    features: [
      { title: 'Interaktivn\u00ed r\u00fdsov\u00e1n\u00ed', desc: 'Kru\u017enice, \u00fahel, t\u011b\u017enice \u2014 v\u0161e p\u0159\u00edmo na dotykov\u00e9 obrazovce s digit\u00e1ln\u00edm kru\u017e\u00edtkem a prav\u00edtkem.', color: 'bg-[#b8d4f5]', visual: mathSVGGeom },
      { title: 'Animovan\u00e9 postupy', desc: 'Ka\u017ed\u00fd krok v\u00fdpo\u010dtu rozlo\u017een\u00fd krok za krokem s vizu\u00e1ln\u00ed animac\u00ed.', color: 'bg-[#f9c97c]', visual: mathSVGAlgebra },
      { title: 'Statistika \u017eiv\u011b', desc: 'Grafy, tabulky a diagramy, kter\u00e9 \u017e\u00e1ci sami sestavuj\u00ed a okam\u017eit\u011b vid\u00ed v\u00fdsledky.', color: 'bg-[#c9e6c8]', visual: mathSVGStats },
      { title: 'Prostorov\u00e1 geometrie', desc: '3D t\u011blesa, kter\u00e1 lze ot\u00e1\u010det a prozkoumat ze v\u0161ech stran.', color: 'bg-[#e8d5f5]', visual: mathSVG3D },
      { title: 'Okam\u017eit\u00e1 zp\u011btn\u00e1 vazba', desc: 'V\u00edce pokus\u016f, \u017e\u00e1dn\u00fd stres \u2014 chyba je sou\u010d\u00e1st\u00ed u\u010den\u00ed.', color: 'bg-[#fde8d0]', visual: mathSVGFeedback },
      { title: 'Podle RVP 2025', desc: 'Pln\u011b slad\u011bn\u00fd s nov\u00fdm r\u00e1mcov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visual: mathSVGRVP },
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
        { label: 'Č\u00edsla do 1\u00a0000\u00a0000', color: '#b8d4f5', emoji: '\uD83D\uDD22' },
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
    authorIntroHeading: '\u2013 \u010c\u00edm je matematika jin\u00e1? \u00davodn\u00ed slovo autora',
    authorIntroBody:
      'Matematiku ve Vividbooks stav\u00edme na vizu\u00e1ln\u00edch postupech, okam\u017eit\u00e9 zp\u011btn\u00e9 vazb\u011b a souladu s \u010desk\u00fdm RVP. Tento \u00favod si uprav\u00edte v administraci v kolekci P\u0159edm\u011bty.',
  },
  'Fyzika': {
    displayName: 'Fyzika',
    displayNameGenitive: 'Fyziky',
    heroTeaserOurWord: 'na\u0161e',
    tagline: 'Experimenty, grafy a re\u00e1ln\u00e9 jevy \u2014 fyzika, kter\u00e1 d\u00e1v\u00e1 smysl.',
    heroColor: '#fff8e8',
    heroColorDark: '#f9c97c',
    accentColor: '#e08000',
    grades: ['2. stupe\u0148'],
    heroRocnikLine: 'pro 6. \u2013 9. ro\u010dn\u00edk',
    stats: [
      { value: '12+', label: 'se\u0161it\u016f' },
      { value: '4', label: 'ro\u010dn\u00edky' },
      { value: '500+', label: 'aktivit' },
      { value: 'M\u0160MT', label: 'd\u016flo\u017eka' },
    ],
    features: [
      { title: 'Virtu\u00e1ln\u00ed experimenty', desc: 'Pokusy, kter\u00e9 nelze ud\u011blat ve t\u0159\u00edd\u011b \u2014 digit\u00e1ln\u011b a bezpe\u010dn\u011b.', color: 'bg-[#f9c97c]', visual: mathSVGGeom },
      { title: 'Dynamick\u00e9 grafy', desc: 'Pohyb, s\u00edla, energie \u2014 \u017eiv\u011b zobrazeno na interaktivn\u00edch grafech.', color: 'bg-[#b8d4f5]', visual: mathSVGStats },
      { title: 'Okam\u017eit\u00e1 zp\u011btn\u00e1 vazba', desc: 'Testov\u00e1n\u00ed pochopen\u00ed s okam\u017eit\u00fdm vyhodnocen\u00edm.', color: 'bg-[#c9e6c8]', visual: mathSVGFeedback },
      { title: 'Podle RVP 2025', desc: 'Soulad s nov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visual: mathSVGRVP },
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
    authorIntroHeading: '\u2013 \u010c\u00edm je fyzika jin\u00e1? \u00davodn\u00ed slovo autora',
    authorIntroBody:
      'Fyziku ve Vividbooks chceme co nejbli\u017e\u0161e re\u00e1ln\u00fdm jev\u016fm: experimenty, grafy a souvislosti, kter\u00e9 se ve t\u0159\u00edd\u011b jen t\u011b\u017eko demonstrovaj\u00ed. Text dopln\u00edte nebo zm\u011bn\u00edte v administraci v kolekci P\u0159edm\u011bty.',
  },
  'P\u0159\u00edrodopis': {
    displayName: 'P\u0159\u00edrodopis',
    displayNameGenitive: 'P\u0159\u00edrodopisu',
    heroTeaserOurWord: 'n\u00e1\u0161',
    tagline: 'Životní prostředí, evoluce a člověk — interaktivně.',
    heroColor: '#edf7ed',
    heroColorDark: '#c9e6c8',
    accentColor: '#2e7d32',
    grades: ['2. stupeň'],
    heroRocnikLine: 'pro 6. \u2013 9. ro\u010dn\u00edk',
    stats: [
      { value: '4', label: 'sešity' },
      { value: '4', label: 'ročníky' },
      { value: '280+', label: 'aktivit' },
      { value: 'MŠMT', label: 'doložka' },
    ],
    features: [
      { title: 'Interaktivní atlasy', desc: 'Rostliny, živočíšta, minéry — přímo v sešitu s rozpoznáváním.', color: 'bg-[#c9e6c8]', visual: mathSVGGeom },
      { title: 'Videa a animace', desc: 'Biologické procesy vidět naživo — buněčné dělení, fotosyntéza, ekosystémy.', color: 'bg-[#b8d4f5]', visual: mathSVGStats },
      { title: 'Zpětná vazba', desc: 'Testy a kvízy s okamžitým vyhodnocením.', color: 'bg-[#fde8d0]', visual: mathSVGFeedback },
      { title: 'Podle RVP 2025', desc: 'Soulad s novým vzdělávacím programem.', color: 'bg-[#d0eef5]', visual: mathSVGRVP },
    ],
    topics: [
      { grade: '2. stupeň', items: [
        { label: 'Biologie buňky', color: '#c9e6c8', emoji: '\uD83D\uDD2C' },
        { label: 'Botanika', color: '#b8d4f5', emoji: '\uD83C\uDF3F' },
        { label: 'Zoologie', color: '#f9c97c', emoji: '\uD83E\uDD81' },
        { label: 'Ekologie', color: '#e8d5f5', emoji: '\uD83C\uDF0D' },
        { label: 'Geologie', color: '#fde8d0', emoji: '\uD83E\uDEA8' },
        { label: 'Člověk', color: '#d0eef5', emoji: '\uD83E\uDDEC' },
      ]},
    ],
    rvpNote: 'P\u0159\u00edrodopis se\u0161ity jsou v souladu s RVP 2025 a rozv\u00edj\u00ed ekologick\u00e9 my\u0161len\u00ed.',
    authorIntroHeading: '\u2013 \u010c\u00edm je p\u0159\u00edrodopis jin\u00fd? \u00davodn\u00ed slovo autora',
    authorIntroBody:
      'P\u0159\u00edrodopis ve Vividbooks propojuje biologii, ekologii a geologii v jeden srozumiteln\u00fd p\u0159\u00edb\u011bh. Klademe d\u016fraz na souvislosti v p\u0159\u00edrod\u011b a praktickou aplikaci v \u0161kole \u2014 bez zbyte\u010dn\u00e9 encyklopedi\u010dnosti. Tento text si uprav\u00edte v administraci v kolekci P\u0159edm\u011bty.',
  },
  'Chemie': {
    displayName: 'Chemie',
    displayNameGenitive: 'Chemie',
    heroTeaserOurWord: 'na\u0161e',
    tagline: 'Atomy, reakce a pokusy \u2014 chemie, kter\u00e1 ohromuje.',
    heroColor: '#f3edf7',
    heroColorDark: '#e8d5f5',
    accentColor: '#7b2d8b',
    grades: ['2. stupe\u0148'],
    heroRocnikLine: 'pro 8. \u2013 9. ro\u010dn\u00edk',
    stats: [
      { value: '8+', label: 'se\u0161it\u016f' },
      { value: '3', label: 'ro\u010dn\u00edky' },
      { value: '400+', label: 'aktivit' },
      { value: 'M\u0160MT', label: 'd\u016flo\u017eka' },
    ],
    features: [
      { title: 'Virtu\u00e1ln\u00ed laborato\u0159', desc: 'Bezpe\u010dn\u00e9 chemick\u00e9 pokusy v digit\u00e1ln\u00edm prost\u0159ed\u00ed.', color: 'bg-[#e8d5f5]', visual: mathSVGGeom },
      { title: '3D molekuly', desc: 'Prostorov\u00e9 modely molekul, kter\u00e9 \u017e\u00e1ci mohou ot\u00e1\u010det.', color: 'bg-[#b8d4f5]', visual: mathSVG3D },
      { title: 'Zp\u011btn\u00e1 vazba', desc: 'Testov\u00e1n\u00ed s okam\u017eit\u00fdm vyhodnocen\u00edm.', color: 'bg-[#c9e6c8]', visual: mathSVGFeedback },
      { title: 'Podle RVP 2025', desc: 'Soulad s nov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visual: mathSVGRVP },
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
    authorIntroHeading: '\u2013 \u010c\u00edm je chemie jin\u00e1? \u00davodn\u00ed slovo autora',
    authorIntroBody:
      'Chemii ve Vividbooks propojujeme s bezpe\u010dn\u00fdmi pokusy, modely a kontextem z ka\u017edodenn\u00edho \u017eivota. \u00davodn\u00ed slovo si uprav\u00edte v administraci v kolekci P\u0159edm\u011bty.',
  },
  'Prvouka': {
    displayName: 'Prvouka',
    displayNameGenitive: 'Prvouky',
    heroTeaserOurWord: 'na\u0161e',
    tagline: 'Sv\u011bt kolem n\u00e1s \u2014 zv\u00edda\u010dka pro nejmen\u0161\u00ed.',
    heroColor: '#fff3e0',
    heroColorDark: '#fde8d0',
    accentColor: '#e65100',
    grades: ['1. stupe\u0148'],
    heroRocnikLine: 'pro 1.\u20132. ro\u010dn\u00edk, dal\u0161\u00ed ve v\u00fdrob\u011b',
    stats: [
      { value: '8+', label: 'se\u0161it\u016f' },
      { value: '3', label: 'ro\u010dn\u00edky' },
      { value: '700+', label: 'aktivit' },
      { value: 'M\u0160MT', label: 'd\u016flo\u017eka' },
    ],
    features: [
      { title: 'P\u0159\u00edroda kolem n\u00e1s', desc: 'Ro\u010dn\u00ed obdob\u00ed, zv\u00ed\u0159ata, rostliny \u2014 v\u0161e interaktivn\u011b.', color: 'bg-[#fde8d0]', visual: mathSVGGeom },
      { title: '\u010clov\u011bk a spole\u010dnost', desc: 'Rodina, \u0161kola, obec \u2014 v\u00fdchova k ob\u010danstv\u00ed od prvn\u00ed t\u0159\u00eddy.', color: 'bg-[#c9e6c8]', visual: mathSVGFeedback },
      { title: 'Zp\u011btn\u00e1 vazba', desc: 'Hern\u00ed aktivity s okam\u017eit\u00fdm vyhodnocen\u00edm.', color: 'bg-[#b8d4f5]', visual: mathSVGAlgebra },
      { title: 'Podle RVP 2025', desc: 'Soulad s nov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visual: mathSVGRVP },
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
    authorIntroHeading: '\u2013 \u010c\u00edm je prvouka jin\u00e1? \u00davodn\u00ed slovo autora',
    authorIntroBody:
      'Prvouku stav\u00edme jako hrav\u00e9 pozn\u00e1v\u00e1n\u00ed sv\u011bta kolem n\u00e1s, s respektem k RVP a praxi u\u010ditel\u016f 1. stupn\u011b. Text uprav\u00edte v administraci v kolekci P\u0159edm\u011bty.',
  },
  '\u010cesk\u00fd jazyk': {
    displayName: '\u010cesk\u00fd jazyk',
    displayNameGenitive: '\u010desk\u00e9ho jazyka',
    heroTeaserOurWord: 'n\u00e1\u0161',
    tagline: 'Psan\u00ed, \u010dten\u00ed a mluvnice \u2014 s rados\u0165\u00ed a bez strachu.',
    heroColor: '#fef9e8',
    heroColorDark: '#fff3a4',
    accentColor: '#c4a000',
    grades: ['1. stupe\u0148'],
    heroRocnikLine: 'pro 1. \u2013 5. ro\u010dn\u00edk',
    stats: [
      { value: '10+', label: 'se\u0161it\u016f' },
      { value: '5', label: 'ro\u010dn\u00edk\u016f' },
      { value: '800+', label: 'aktivit' },
      { value: 'M\u0160MT', label: 'd\u016flo\u017eka' },
    ],
    features: [
      { title: 'Interaktivn\u00ed dikt\u00e1ty', desc: 'Psan\u00ed s okam\u017eit\u00fdm vyhodnocen\u00edm a n\u00e1pov\u011bdou.', color: 'bg-[#fff3a4]', visual: mathSVGAlgebra },
      { title: '\u010cten\u00ed s porozum\u011bn\u00edm', desc: 'Texty s vestav\u011bn\u00fdmi cvi\u010den\u00edmi a animovan\u00fdmi ilustracemi.', color: 'bg-[#b8d4f5]', visual: mathSVGFeedback },
      { title: 'Mluvnice p\u0159\u00edstupn\u011b', desc: 'Gramatika vysv\u011btlen\u00e1 jednoduche, s mno\u017estv\u00edm p\u0159\u00edklad\u016f.', color: 'bg-[#c9e6c8]', visual: mathSVGGeom },
      { title: 'Podle RVP 2025', desc: 'Soulad s nov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visual: mathSVGRVP },
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
    authorIntroHeading: '\u2013 \u010c\u00edm je \u010desk\u00fd jazyk jin\u00fd? \u00davodn\u00ed slovo autora',
    authorIntroBody:
      '\u010cesk\u00fd jazyk ve Vividbooks propojuje \u010dten\u00ed, psan\u00ed a mluvnici s interaktivn\u00edmi cvi\u010den\u00edmi a okam\u017eitou zp\u011btnou vazbou. \u00davod dopln\u00edte v administraci v kolekci P\u0159edm\u011bty.',
  },
};