/**
 * Vzorové stránky „Nechte se inspirovat“ — obsah pro ukázky na tomto webu.
 * Slug odpovídá produkční URL: vividbooks.com/cs/vividboard/inspirace/:slug
 */

export type InspirationCategoryKey = 'kvizy' | 'lekce' | 'materialy' | 'testy' | 'dotazniky' | 'karty';

export type VividboardShowcase = {
  slug: string;
  title: string;
  categoryKey: InspirationCategoryKey;
  /** Nadpis typu materiálu (např. Interaktivní lekce) */
  categoryLabel: string;
  intro: string;
  /** Odstavce struktury; **text** se zobrazí tučně */
  structureParagraphs: string[];
};

const INTRO_LEKCE =
  'Představte si, že se svými žáky můžete postupovat krok za krokem. Nejprve jim něco vysvětlíte, poté ověříte, zda tomu rozumí. Můžete uspořádat soutěž a udělovat body za správné odpovědi. Následně můžete získat jejich zpětnou vazbu a názory přes nástroj nástěnka.';

const INTRO_KVIZ =
  'Kvíz spojuje rychlé otázky, okamžité vyhodnocení a soutěžní atmosféru. Studenti odpovídají na zařízeních, výsledky vidíte na tabuli — výborně se hodí k opakování i motivaci.';

const INTRO_MATERIALY =
  'Materiál kombinuje výklad, vizualizace a krátké úkoly. Žáci mohou pracovat vlastním tempem nebo společně pod vaším vedením v režimu promítání.';

const INTRO_TESTY =
  'Test ověřuje znalosti formou uzavřených úloh a krátkých odpovědí. Výsledky můžete sledovat v přehledu a žákům dát cílenou zpětnou vazbu.';

const INTRO_DOTAZNIKY =
  'Dotazník sbírá názory a údaje bez tlaku — hodí se na zpětnou vazbu, přihlášky nebo spokojenost ve třídě. Odpovědi máte přehledně na jednom místě.';

const INTRO_KARTY =
  'Studijní karty procvičují pojmy v krátkých intervalech. Kombinujte text, obrázky a samokontrolu, aby si žáci látku lépe zapamatovali.';

export const VIVIDBOARD_SHOWCASES: VividboardShowcase[] = [
  {
    slug: 'dejepis-zacatek-1-svetove-valky',
    title: 'Dějepis: Začátek 1. světové války',
    categoryKey: 'lekce',
    categoryLabel: 'Interaktivní lekce',
    intro: INTRO_LEKCE,
    structureParagraphs: [
      'Se žáky budeme probírat začátek první světové války. Nejprve je důležité si uvědomit kontext doby, ve které se pohybujeme. **K tomu použijeme informační slidy s textem**, obrázky a dobovým videem. Dalším krokem je pochopení, jak vypadal svět před první světovou válkou, což ilustrujeme pomocí mapy. Poté následují dva slidy s nástrojem nástěnka, kam mohou žáci psát své postřehy o tom, v čem se mapa liší od té dnešní.',
      'Postupně se dozvíme o situaci v jednotlivých mocnostech před válkou. Na informačních slidech se žáci seznámí s klíčovými fakty, ze kterých jsou pak jednoduše zkoušeni. Ověření porozumění probíhá přes Aktivity ABC, kde zjistíme, zda žáci správně pochopili a poslouchali.',
      'Z analýzy situací v jednotlivých mocnostech mohou žáci vydedukovat, kde by mohlo dojít ke konfliktu. Lekce je doprovázena videi, z nichž jsou žáci také zkoušeni, nebo mají za úkol napsat své poznatky formou kritického myšlení. Na závěr lekce žáci rekapitulují, co důležitého se dnes naučili.',
    ],
  },
  {
    slug: 'hudebni-vychova-kviz-popularni-hudby',
    title: 'Hudební výchova: Kvíz populární hudby',
    categoryKey: 'kvizy',
    categoryLabel: 'Soutěžní kvízy',
    intro: INTRO_KVIZ,
    structureParagraphs: [
      'Kvíz provede žáky styly a epochami populární hudby pomocí poslechu a krátkých otázek. **Správné odpovědi** můžete vyhodnocovat okamžitě a přidat časovač pro soutěžní režim.',
      'Na závěr shrňte nejčastější omyly a nechte žáky tipovat interpreta nebo žánr u bonusové otázky.',
    ],
  },
  {
    slug: 'informatika-unikova-hra',
    title: 'Informatika: Úniková hra',
    categoryKey: 'kvizy',
    categoryLabel: 'Soutěžní kvízy',
    intro: INTRO_KVIZ,
    structureParagraphs: [
      'Úniková hra řetězí úkoly z bezpečnosti, logiky a práce s informací. Každý správný krok odemkne další scénář — vhodné pro skupinovou spolupráci i individuální tempo.',
      'Využijte kombinaci výkladu, skrytých nápověd a časového limitu pro zvýšení napětí.',
    ],
  },
  {
    slug: 'fyzika-skladani-sil',
    title: 'Fyzika: Skládání sil',
    categoryKey: 'lekce',
    categoryLabel: 'Interaktivní lekce',
    intro: INTRO_LEKCE,
    structureParagraphs: [
      'Lekce vysvětluje složení sil na jednoduchých příkladech z každodenního života. **Vizuální schémata** a animace pomohou pochopit směr a velikost výslednice.',
      'Žáci řeší krátké úlohy s okamžitou kontrolou a na závěr shrnují pravidla ve vlastních větách na nástěnce.',
    ],
  },
  {
    slug: 'vzajemna-poloha-dvou-primek',
    title: 'Matematika: Vzájemná poloha dvou přímek',
    categoryKey: 'materialy',
    categoryLabel: 'Učební materiály a prezentace',
    intro: INTRO_MATERIALY,
    structureParagraphs: [
      'Materiál systematicky prochází rovnoběžky, různoběžky a kolčí vztah. **Definice a příklady** jsou doplněné interaktivními úkoly přímo ve slidech.',
      'Pro procvičení přidejte sadu úloh s různou obtížností a nechte žáky pracovat samostatně nebo ve dvojicích.',
    ],
  },
  {
    slug: 'prvociselny-rozklad-na-soucin',
    title: 'Matematika: Prvočíselný rozklad na součin',
    categoryKey: 'materialy',
    categoryLabel: 'Učební materiály a prezentace',
    intro: INTRO_MATERIALY,
    structureParagraphs: [
      'Prezentace ukazuje postup rozkladu pomocí stromu činitelů i dělení postupně **prvočísly**. Žáci si vyzkouší typické úlohy a ověří výsledek násobením.',
      'Závěrečný blok může propojit rozklad s hledáním nejmenšího společného násobku a největšího společného dělitele.',
    ],
  },
  {
    slug: 'odcitani-desetinnych-cisel',
    title: 'Matematika: Odčítání desetinných čísel',
    categoryKey: 'testy',
    categoryLabel: 'Testy a písemky',
    intro: INTRO_TESTY,
    structureParagraphs: [
      'Test obsahuje úlohy na doplnění desetinných míst, převody a slovní úlohy. **Automatické vyhodnocení** šetří čas a ukáže časté chyby.',
      'Doporučte žákům kontrolu odčítáním „obráceným“ sčítáním u vybraných příkladů.',
    ],
  },
  {
    slug: 'chemie-smesi',
    title: 'Chemie: Směsi',
    categoryKey: 'testy',
    categoryLabel: 'Testy a písemky',
    intro: INTRO_TESTY,
    structureParagraphs: [
      'Ověřte rozlišení homogenních a heterogenních směsí, roztoků a suspenzí. Krátké otázky s obrázky pomohou žákům **spojit pojmy s realitou**.',
      'Zakončete praktickým příkladem separace složek nebo ředění roztoků.',
    ],
  },
  {
    slug: 'spokojenost-ve-skole',
    title: 'Spokojenost ve škole',
    categoryKey: 'dotazniky',
    categoryLabel: 'Dotazníky',
    intro: INTRO_DOTAZNIKY,
    structureParagraphs: [
      'Dotazník mapuje klima ve třídě: vztahy, předměty, volný čas. **Anonymní režim** podporuje upřímné odpovědi; výsledky agregujte v přehledu.',
      'Výstupy můžete použít jako podklad pro třídnické hodiny nebo projektové dny.',
    ],
  },
  {
    slug: 'prihlaska-na-skolni-vylet',
    title: 'Přihláška na školní výlet',
    categoryKey: 'dotazniky',
    categoryLabel: 'Dotazníky',
    intro: INTRO_DOTAZNIKY,
    structureParagraphs: [
      'Formulář sbírá souhlas rodičů, dietní omezení a kontakty. Pole lze přizpůsobit konkrétní akci a **exportovat** pro organizátory.',
      'Připomeňte termín uzávěrky a způsob potvrzení účasti přímo v úvodu materiálu.',
    ],
  },
  {
    slug: 'prirodopis-savci-a-ptaci',
    title: 'Přírodopis: Savci a ptáci',
    categoryKey: 'karty',
    categoryLabel: 'Procvičování a studijní karty',
    intro: INTRO_KARTY,
    structureParagraphs: [
      'Karty střídají obrázky, pojmy a vlastnosti — od srsti a křídel po potravní řetězce. **Režim náhodného výběru** pomůže opakovat celé téma.',
      'Doplňte krátké úkoly „vyber správně“ podle znaků vybraného kmene.',
    ],
  },
  {
    slug: 'anglicky-jazyk-zakladni-slovicka',
    title: 'Anglický jazyk: Základní slovíčka',
    categoryKey: 'karty',
    categoryLabel: 'Procvičování a studijní karty',
    intro: INTRO_KARTY,
    structureParagraphs: [
      'Slovíčka jsou seskupená podle témat (škola, rodina, volný čas). Kombinujte překlad, poslech a doplnění vět s **okamžitou kontrolou**.',
      'Pro závěr přidejte minikonverzaci nebo pexeso s páry cz/en.',
    ],
  },
];

const bySlug = new Map(VIVIDBOARD_SHOWCASES.map((s) => [s.slug, s]));

export function getVividboardShowcase(slug: string | undefined): VividboardShowcase | undefined {
  if (!slug) return undefined;
  return bySlug.get(slug);
}

/** Pro sekci „Nechte se inspirovat“ na detailu — stejná struktura jako na /vividboard */
export const INSPIRATION_NAV_GROUPS: { title: string; items: { label: string; slug: string }[] }[] = [
  {
    title: 'Soutěžní kvízy',
    items: [
      { label: 'Hudební výchova: Kvíz populární hudby', slug: 'hudebni-vychova-kviz-popularni-hudby' },
      { label: 'Informatika: Úniková hra', slug: 'informatika-unikova-hra' },
    ],
  },
  {
    title: 'Interaktivní lekce',
    items: [
      { label: 'Dějepis: Začátek 1. světové války', slug: 'dejepis-zacatek-1-svetove-valky' },
      { label: 'Fyzika: Skládání sil', slug: 'fyzika-skladani-sil' },
    ],
  },
  {
    title: 'Učební materiály a prezentace',
    items: [
      { label: 'Matematika: Vzájemná poloha dvou přímek', slug: 'vzajemna-poloha-dvou-primek' },
      { label: 'Matematika: Prvočíselný rozklad na součin', slug: 'prvociselny-rozklad-na-soucin' },
    ],
  },
  {
    title: 'Testy a písemky',
    items: [
      { label: 'Matematika: Odčítání desetinných čísel', slug: 'odcitani-desetinnych-cisel' },
      { label: 'Chemie: Směsi', slug: 'chemie-smesi' },
    ],
  },
  {
    title: 'Dotazníky',
    items: [
      { label: 'Spokojenost ve škole', slug: 'spokojenost-ve-skole' },
      { label: 'Přihláška na školní výlet', slug: 'prihlaska-na-skolni-vylet' },
    ],
  },
  {
    title: 'Procvičování a studijní karty',
    items: [
      { label: 'Přírodopis: Savci a ptáci', slug: 'prirodopis-savci-a-ptaci' },
      { label: 'Anglický jazyk: Základní slovíčka', slug: 'anglicky-jazyk-zakladni-slovicka' },
    ],
  },
];
