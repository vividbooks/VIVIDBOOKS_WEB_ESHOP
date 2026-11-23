/**
 * Otevřené pozice pro sekci Kariéra na stránce Kontakt.
 * Plat se v inzerátech neuvádí. Pozici skryjete nastavením `published: false`.
 */
export type CareerPosition = {
  id: string;
  title: string;
  /** Kde se pracuje (město, region, na dálku). */
  place: string;
  /** Krátké uvedení: proč pozice vzniká a koho hledáme. */
  intro: string;
  sections: { heading: string; items: string[] }[];
  published: boolean;
};

export const CAREER_CONTACT_EMAIL = 'vitek@vividbooks.com';

export const CAREER_POSITIONS: CareerPosition[] = [
  {
    id: 'head-of-sales',
    title: 'Head of Sales',
    place: 'Praha a celá ČR',
    intro:
      'Na 2. stupni s námi učí stovky škol a většina z nich k nám přišla přes webináře a zkušební přístupy. Teď vstupujeme na 1. stupeň a k marketingu potřebujeme přidat aktivní obchod přímo na školách. Hledáme člověka, který ho postaví a povede.',
    sections: [
      {
        heading: 'Co budete dělat',
        items: [
          'Postavíte a povedete obchodní tým, v terénu i po telefonu, a budete odpovídat za jeho výsledky.',
          'Nastavíte, jak prodáváme: oslovování škol, ukázky ve sborovnách, zkušební přístupy, obnovy licencí.',
          'Povedete vstup na 1. stupeň, kde začínáme s matematikou a prvoukou.',
          'Důležité školy a první obchody v nových oblastech si vezmete sami.',
          'Budete pracovat s čísly: plán, CRM a přehled o tom, co funguje a co ne.',
          'Propojíte obchod s marketingem (webináře, kampaně) a s distributory tištěných sešitů.',
        ],
      },
      {
        heading: 'Co byste měli umět',
        items: [
          'Vedli jste obchodní tým, nebo jste ho stavěli od začátku.',
          'Máte zkušenost s prodejem školám nebo s podobně dlouhým prodejem institucím.',
          'Umíte prodávat sami, nejen řídit ostatní.',
          'Rozhodujete se podle čísel a pořádek v CRM je pro vás samozřejmost.',
          'Výhodou je znalost prostředí základních škol, učebnic nebo vzdělávacích technologií.',
        ],
      },
      {
        heading: 'Co nabízíme',
        items: [
          'Produkt, který na školách funguje a který učitelé znají.',
          'Volnou ruku při stavbě týmu a přímou spolupráci se zakladateli.',
          'Malý tým, ve kterém se rozhoduje rychle.',
        ],
      },
    ],
    published: true,
  },
  {
    id: 'senior-obchodnik-praha',
    title: 'Seniorní obchodník / obchodnice',
    place: 'Praha a střední Čechy',
    intro:
      'Hledáme zkušeného obchodníka nebo obchodnici pro základní školy v Praze a ve Středočeském kraji. Budete mít na starosti školy, které s námi už učí, i ty, které nás zatím neznají.',
    sections: [
      {
        heading: 'Co budete dělat',
        items: [
          'Jezdit na školy, představovat Vividbooks ředitelům a učitelům a vést ukázky ve sborovnách.',
          'Provést školu od zkušebního přístupu k licenci a k objednávce pracovních sešitů.',
          'Starat se o stávající školy a hlídat obnovy jejich licencí.',
          'Otevírat školám 1. stupeň: matematiku a prvouku.',
          'Vést si obchody v CRM a plánovat si vlastní týden.',
          'Nosit z terénu zpětnou vazbu redakci a vývoji.',
        ],
      },
      {
        heading: 'Co byste měli umět',
        items: [
          'Máte za sebou několik let v obchodě a obchody uzavíráte samostatně.',
          'Ideálně jste už prodávali školám nebo jiným institucím.',
          'Bydlíte v Praze nebo ve středních Čechách a máte řidičský průkaz skupiny B.',
          'Umíte mluvit s řediteli i s učiteli a vysvětlit věci jednoduše.',
          'Výhodou je zkušenost z učitelské praxe.',
        ],
      },
      {
        heading: 'Co nabízíme',
        items: [
          'Zavedený produkt a zájemce, které přivádějí webináře a kampaně.',
          'Zázemí kolegů, kteří pomohou s nabídkami, objednávkami a licencemi.',
          'Samostatnost a prostor udělat si práci po svém.',
        ],
      },
    ],
    published: true,
  },
  {
    id: 'asistent-obchodu',
    title: 'Asistent / asistentka obchodu',
    place: 'Na dálku, odkudkoli z Česka',
    intro:
      'Naši obchodníci jsou na školách a každá hodina ukázky se počítá. Hledáme někoho, kdo jim ukázky domluví, bude s nimi úzce spolupracovat a bude pro ně hledat příležitosti, kde se dá prodat. Pracovat můžete z domova.',
    sections: [
      {
        heading: 'Co budete dělat',
        items: [
          'Domlouvat obchodníkům prezentace a ukázky na školách: oslovíte školu, najdete termín a pohlídáte, aby se ukázka opravdu konala.',
          'Úzce spolupracovat s obchodníky: znát jejich regiony, plány a priority a být jim po ruce.',
          'Hledat příležitosti: školy, které zkoušely naše přístupy, přišly na webinář nebo jim končí licence, a předávat je obchodníkům hotové k oslovení.',
          'Udržovat pořádek v CRM: kontakty škol, obchody a úkoly.',
          'Po ukázkách navázat, nabídnout další krok a pohlídat, aby žádná škola nezůstala bez odpovědi.',
          'Pomáhat s podklady, nabídkami a agendou kolem webinářů.',
        ],
      },
      {
        heading: 'Co byste měli umět',
        items: [
          'Umíte oslovit cizího člověka po telefonu i e-mailem a nevadí vám dohánět odpověď.',
          'Jste spolehliví, pečliví a umíte pracovat samostatně i na dálku.',
          'Píšete bezchybnou češtinou a jednáte příjemně a věcně.',
          'Nedělají vám potíže tabulky a rádi se naučíte CRM a další nástroje.',
          'Výhodou je zkušenost z obchodu, z obchodního zázemí nebo ze školy.',
        ],
      },
      {
        heading: 'Co nabízíme',
        items: [
          'Práci z domova a pružnou pracovní dobu.',
          'Práci v těsném kontaktu s obchodníky a se zakladateli.',
          'Důkladné zaučení a kolegy, kteří poradí.',
          'Smysluplný obor: pomáháte učitelům učit lépe.',
        ],
      },
    ],
    published: true,
  },
];
