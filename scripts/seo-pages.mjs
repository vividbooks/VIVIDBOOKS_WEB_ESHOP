/**
 * Katalog SEO obsahu pro build-time prerender (AI / retrieval crawlers).
 * path → title, description, h1, h2, answer capsule, volitelně jsonLd.
 */

export const SITE_URL = 'https://www.vividbooks.com';
export const SITE_NAME = 'Vividbooks';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Vividbooks',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
  description: 'Interaktivní digitální učebnice pro české základní školy.',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+420-602-227-674',
    email: 'hello@vividbooks.com',
    contactType: 'customer service',
    availableLanguage: 'Czech',
  },
  sameAs: [
    'https://www.facebook.com/vividbooks',
    'https://www.instagram.com/vividbooks',
    'https://www.linkedin.com/company/vividbooks',
  ],
};

/** Společné interní odkazy pro crawlable nav. */
export const NAV_LINKS = [
  { href: '/', label: 'Katalog' },
  { href: '/katalog', label: 'Čistý katalog' },
  { href: '/predmet/matematika-2-stupen', label: 'Matematika 2. stupeň' },
  { href: '/predmet/fyzika', label: 'Fyzika' },
  { href: '/predmet/prirodopis', label: 'Přírodopis' },
  { href: '/predmet/chemie', label: 'Chemie' },
  { href: '/predmet/matematika-1-stupen', label: 'Matematika 1. stupeň' },
  { href: '/webinare', label: 'Webináře' },
  { href: '/blog', label: 'Blog' },
  { href: '/novinky', label: 'Novinky' },
  { href: '/vyzkousejte', label: 'Vyzkoušejte zdarma' },
  { href: '/objednat', label: 'Objednat' },
  { href: '/kontakt', label: 'Kontakt' },
];

function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

function subjectPage({ path, title, tagline, answer, h2 }) {
  return {
    path,
    title,
    description: `${title} — ${tagline}`,
    h1: title,
    h2: h2 || 'Proč Vividbooks',
    answer,
    jsonLd: [
      breadcrumb([
        { name: 'Katalog', url: '/' },
        { name: title, url: path },
      ]),
    ],
  };
}

/** @type {Array<{ path: string, title: string, description: string, h1: string, h2?: string, answer: string, jsonLd?: object[] }>} */
export const SEO_PAGES = [
  {
    path: '/',
    title: 'Vividbooks – Učení, které inspiruje a baví.',
    description:
      'Kompletní katalog interaktivních digitálních učebnic a pracovních sešitů Vividbooks pro české základní školy. Matematika, fyzika, chemie, přírodopis a další.',
    h1: 'Vividbooks — učení, které inspiruje a baví',
    h2: 'Digitální učebnice a pracovní sešity pro ZŠ',
    answer:
      'Vividbooks jsou učební materiály pro české základní školy: pracovní sešity a tiskoviny se smysluplně doplňují s online podporou — animacemi, interaktivními lekcemi a nástroji pro učitele. Nabízíme matematiku, fyziku, chemii, přírodopis, český jazyk, prvouku a další předměty pro 1. i 2. stupeň.',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        description:
          'Interaktivní digitální učebnice a pracovní sešity pro české základní školy.',
        inLanguage: 'cs-CZ',
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
    ],
  },
  {
    path: '/katalog',
    title: 'Katalog',
    description: 'Čistý katalog pracovních sešitů a učebnic Vividbooks pro školní rok 2026/2027.',
    h1: 'Katalog Vividbooks',
    h2: 'Pracovní sešity a učebnice',
    answer:
      'Prohlédněte si kompletní katalog pracovních sešitů a digitálních učebnic Vividbooks pro základní školy. Filtrujte podle předmětu, ročníku a typu materiálu.',
    jsonLd: [breadcrumb([{ name: 'Katalog', url: '/katalog' }])],
  },
  {
    path: '/blog',
    title: 'Blog',
    description:
      'Blog Vividbooks — inspirace, rozhovory s učiteli a novinky ze světa moderního vzdělávání na českých základních školách.',
    h1: 'Ze světa vzdělávání',
    h2: 'Blog Vividbooks',
    answer:
      'Blog Vividbooks přináší inspiraci, rozhovory s učiteli a tipy pro moderní výuku na českých základních školách — od digitálních učebnic po metodiku.',
    jsonLd: [breadcrumb([{ name: 'Blog', url: '/blog' }])],
  },
  {
    path: '/novinky',
    title: 'Novinky',
    description:
      'Novinky z Vividbooks — aktuální informace o nových produktech, digitálních učebnicích a dění ve světě moderního vzdělávání.',
    h1: 'Novinky',
    h2: 'Aktuality z Vividbooks',
    answer:
      'Novinky Vividbooks shrnují aktuální informace o nových produktech, aktualizacích digitálních učebnic a dění ve firmě.',
    jsonLd: [breadcrumb([{ name: 'Novinky', url: '/novinky' }])],
  },
  {
    path: '/webinare',
    title: 'Záznamy DVPP webinářů',
    description:
      'Záznamy DVPP webinářů Vividbooks pro učitele — interaktivní výuka, digitální učebnice, metodické tipy a novinky ze světa vzdělávání.',
    h1: 'DVPP webináře Vividbooks',
    h2: 'Webináře pro učitele s osvědčením DVPP',
    answer:
      'Vividbooks pořádá pravidelné DVPP webináře pro učitele zdarma s certifikátem. Najdete zde živé termíny i záznamy o interaktivní výuce a digitálních učebnicích.',
    jsonLd: [breadcrumb([{ name: 'Webináře', url: '/webinare' }])],
  },
  {
    path: '/vyzkousejte',
    title: 'Vyzkoušejte zdarma',
    description: 'Získejte 14denní zkušební přístup k digitálním učebnicím Vividbooks zdarma.',
    h1: 'Vyzkoušejte Vividbooks zdarma',
    h2: '14denní zkušební přístup',
    answer:
      'Získejte 14denní zkušební přístup k digitálním učebnicím Vividbooks zdarma. Ideální pro učitele a školy, které chtějí materiály vyzkoušet před objednávkou.',
    jsonLd: [breadcrumb([{ name: 'Vyzkoušejte zdarma', url: '/vyzkousejte' }])],
  },
  {
    path: '/kontakt',
    title: 'Kontakt',
    description:
      'Kontaktujte Vividbooks: telefon +420 602 227 674, e-mail hello@vividbooks.com. Obchodní zástupci po krajích, redakce a distribuce.',
    h1: 'Kontaktujte Vividbooks',
    h2: 'Obchodní zástupci a podpora',
    answer:
      'Kontakt Vividbooks: telefon +420 602 227 674, e-mail hello@vividbooks.com. Pomůžeme s objednávkou pro školu, trial přístupem i výběrem předmětů.',
    jsonLd: [breadcrumb([{ name: 'Kontakt', url: '/kontakt' }])],
  },
  {
    path: '/objednat',
    title: 'Objednávka pro školu',
    description: 'Objednejte pracovní sešity a digitální učebnice Vividbooks pro vaši školu.',
    h1: 'Objednávka pro školu',
    h2: 'Pracovní sešity a digitální učebnice',
    answer:
      'Objednejte pracovní sešity a digitální učebnice Vividbooks pro vaši školu online. Vyberte předměty a ročníky, doplňte údaje školy a odešlete objednávku.',
    jsonLd: [breadcrumb([{ name: 'Objednat', url: '/objednat' }])],
  },
  {
    path: '/dalsi-produkty',
    title: 'Další produkty',
    description:
      'Další produkty Vividbooks — doplňkové materiály, plakáty a nástroje pro výuku na základní škole.',
    h1: 'Další produkty Vividbooks',
    h2: 'Doplňkové materiály pro výuku',
    answer:
      'Prohlédněte si další produkty Vividbooks mimo hlavní katalog učebnic — doplňkové materiály a nástroje pro výuku na ZŠ.',
    jsonLd: [breadcrumb([{ name: 'Další produkty', url: '/dalsi-produkty' }])],
  },
  {
    path: '/aplikace',
    title: 'Nová aplikace Vividbooks',
    description:
      'V srpnu spouštíme novou aplikaci Vividbooks. Knihovna, lekce, procvičování, vividboard i umělá inteligence — vše na jednom místě, pod jedním přihlášením.',
    h1: 'Nová aplikace Vividbooks',
    h2: 'Knihovna, lekce a Vividboard',
    answer:
      'Nová aplikace Vividbooks spojuje knihovnu, lekce, procvičování, Vividboard i umělou inteligenci na jednom místě pod jedním přihlášením.',
    jsonLd: [breadcrumb([{ name: 'Aplikace', url: '/aplikace' }])],
  },
  {
    path: '/akce',
    title: 'Akce — výhodné balíčky',
    description:
      'Akční balíčky učebnic a materiálů Vividbooks. Přidejte balíček do objednávky pro školu.',
    h1: 'Akční balíčky Vividbooks',
    h2: 'Výhodné sady pro školy',
    answer:
      'Akční balíčky Vividbooks nabízejí výhodné sady učebnic a materiálů pro školy. Balíček snadno přidáte do objednávky.',
    jsonLd: [breadcrumb([{ name: 'Akce', url: '/akce' }])],
  },
  {
    path: '/vividboard',
    title: 'Vividboard',
    description:
      'Vividboard — nástroj Vividbooks pro interaktivní tabule a moderní výuku na základní škole.',
    h1: 'Vividboard',
    h2: 'Interaktivní tabule pro výuku',
    answer:
      'Vividboard je nástroj Vividbooks pro interaktivní tabule. Učitelé mohou vést moderní výuku s materiály z digitálních učebnic.',
    jsonLd: [breadcrumb([{ name: 'Vividboard', url: '/vividboard' }])],
  },
  {
    path: '/kampane/matematika-2-stupen',
    title: 'Matematika 2. stupeň',
    description:
      'Matematika Vividbooks pro 6.–9. ročník ZŠ — pracovní sešity s online podporou, doložka MŠMT a materiály podle revize RVP.',
    h1: 'Matematika 2. stupeň',
    h2: 'Pracovní sešity s online podporou',
    answer:
      'Matematika Vividbooks pro 2. stupeň kombinuje pracovní sešity s online podporou pro 6.–9. ročník. Materiály mají doložku MŠMT a sledují revizi RVP.',
    jsonLd: [
      breadcrumb([
        { name: 'Katalog', url: '/' },
        { name: 'Matematika 2. stupeň', url: '/kampane/matematika-2-stupen' },
      ]),
    ],
  },
  {
    path: '/kampane/editor-sesitu',
    title: 'Editor sešitů',
    description:
      'Sestavte si vlastní pracovní sešit z materiálů Vividbooks i vlastních podkladů. Vividbooks jej vytiskne a doručí do školy.',
    h1: 'Editor sešitů Vividbooks',
    h2: 'Vlastní pracovní sešit pro vaši třídu',
    answer:
      'Editor sešitů Vividbooks umožňuje sestavit vlastní pracovní sešit z materiálů Vividbooks i vlastních podkladů. Sešit vytiskneme a doručíme do školy.',
    jsonLd: [
      breadcrumb([
        { name: 'Katalog', url: '/' },
        { name: 'Editor sešitů', url: '/kampane/editor-sesitu' },
      ]),
    ],
  },
  {
    path: '/dvpp-webinare',
    title: 'DVPP webináře',
    description:
      'DVPP webináře Vividbooks pro učitele — zdarma, s osvědčením DVPP a praktickými tipy do výuky. Záznamy v knihovně pro celou sborovnu.',
    h1: 'DVPP webináře',
    h2: 'Vzdělávání učitelů zdarma',
    answer:
      'Přihlaste se na DVPP webináře Vividbooks. Webináře jsou zdarma, s osvědčením DVPP a tipy pro interaktivní výuku; záznamy najdete v knihovně dvppzdarma.cz.',
    jsonLd: [breadcrumb([{ name: 'DVPP webináře', url: '/dvpp-webinare' }])],
  },

  // Předměty
  subjectPage({
    path: '/predmet/matematika-2-stupen',
    title: 'Matematika 2. stupeň',
    tagline: 'Pracovní sešity s online podporou pro 6.–9. ročník ZŠ',
    h2: 'Matematika pro 6.–9. ročník',
    answer:
      'Matematika Vividbooks pro 2. stupeň kombinuje pracovní sešity s online podporou pro 6.–9. ročník základní školy. Žáci procvičují s animacemi a interaktivními úlohami; učitelé mají metodickou podporu a materiály s doložkou MŠMT.',
  }),
  subjectPage({
    path: '/predmet/fyzika',
    title: 'Fyzika',
    tagline: 'Animované experimenty, simulace a interaktivní lekce',
    h2: 'Interaktivní fyzika pro ZŠ',
    answer:
      'Digitální učebnice fyziky Vividbooks nabízejí animované experimenty, simulace a interaktivní lekce pro druhý stupeň základní školy.',
  }),
  subjectPage({
    path: '/predmet/prirodopis',
    title: 'Přírodopis',
    tagline: '3D modely, interaktivní lekce a badatelské listy',
    h2: 'Přírodopis s 3D modely',
    answer:
      'Přírodopis Vividbooks propojuje 3D modely, interaktivní lekce a badatelské listy — žáci zkoumají živou i neživou přírodu moderním způsobem.',
  }),
  subjectPage({
    path: '/predmet/chemie',
    title: 'Chemie',
    tagline: 'Animované reakce a bezpečné digitální pokusy',
    h2: 'Chemie s animovanými reakcemi',
    answer:
      'Digitální učebnice chemie Vividbooks ukazují animované reakce a bezpečné digitální pokusy. Ideální doplněk k výuce chemie na 2. stupni ZŠ.',
  }),
  subjectPage({
    path: '/predmet/matematika-1-stupen',
    title: 'Matematika 1. stupeň',
    tagline: 'Pracovní sešity a digitální materiály pro 1.–5. ročník',
    h2: 'Matematika pro 1.–5. ročník',
    answer:
      'Matematika Vividbooks pro 1. stupeň nabízí pracovní sešity a digitální materiály pro 1.–5. ročník ZŠ — srozumitelné, hravé a v souladu s RVP.',
  }),
  subjectPage({
    path: '/predmet/cesky-jazyk',
    title: 'Český jazyk',
    tagline: 'Písanky a pracovní sešity českého jazyka',
    h2: 'Český jazyk pro 1. stupeň',
    answer:
      'Český jazyk Vividbooks zahrnuje písanky a pracovní sešity pro žáky 1. stupně základní školy.',
  }),
  subjectPage({
    path: '/predmet/prvouka',
    title: 'Prvouka',
    tagline: 'Učební materiály prvouky pro 1. stupeň',
    h2: 'Prvouka pro nejmenší',
    answer:
      'Prvouka Vividbooks přináší učební materiály pro 1. stupeň — žáci poznávají svět kolem sebe s podporou tištěných i digitálních materiálů.',
  }),
];
