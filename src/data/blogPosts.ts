export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: number; // minutes
  category: string;
  coverImage: string;
  content: BlogBlock[];
  published?: boolean;       // true = živý, false = koncept, undefined = živý (zpětná kompatibilita)
  contentHtml?: string;      // raw HTML z Webflow (pro re-import)
  importedAt?: string;
}

export type BlogBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'video'; url: string; title?: string }
  | { type: 'slider'; images: { src: string; alt?: string; caption?: string }[]; caption?: string }
  | { type: 'tabs'; tabs: { label: string; content: string; imageUrl?: string }[]; heading?: string };

export const BLOG_POSTS: BlogPost[] = [
  {
    id: '1',
    slug: 'financni-gramotnost-pro-skoly',
    title: 'Inspirace do v\u00fduky: Finan\u010dn\u00ed gramotnost pro \u0161koly jednodue, interaktivn\u011b a zdarma',
    excerpt:
      'S Vividbooks v\u00e1m r\u00e1di p\u0159in\u00e1\u0161\u00edme zaj\u00edmav\u00e9 projekty na inspiraci do v\u00fduky \u2013 a pr\u00e1v\u011b Skoala n\u00e1s opravdu nadchla. Tato digit\u00e1ln\u00ed platforma z d\u00edlny Nadace \u010cesk\u00e9 spo\u0159itelny sjednoc\u00e1v\u00e1 roztr\u00ed\u0161t\u011bnou v\u00fduku finan\u010dn\u00ed gramotnosti na z\u00e1kladn\u00edch a st\u0159edn\u00edch \u0161kol\u00e1ch.',
    author: 'V\u00edtek \u0160kop',
    date: '15. \u00fanora 2026',
    readTime: 8,
    category: 'Inspirace',
    coverImage:
      'https://images.unsplash.com/photo-1569602518783-f2003aebc672?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNpYWwlMjBsaXRlcmFjeSUyMGVkdWNhdGlvbiUyMGNvbG9yZnVsJTIwaWxsdXN0cmF0iW0qJTIwbW9uZXl8ZW58MXx8fHwxNzcyMzU3NDg4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    content: [
      {
        type: 'paragraph',
        text: 'S Vividbooks v\u00e1m r\u00e1di p\u0159in\u00e1\u0161\u00edme zaj\u00edmav\u00e9 projekty na inspiraci do v\u00fduky \u2013 a pr\u00e1v\u011b Skoala n\u00e1s opravdu nadchla. Tato digit\u00e1ln\u00ed platforma z d\u00edlny Nadace \u010cesk\u00e9 spo\u0159itelny sjednoc\u00e1v\u00e1 roztr\u00ed\u0161t\u011bnou v\u00fduku finan\u010dn\u00ed gramotnosti na z\u00e1kladn\u00edch a st\u0159edn\u00edch \u0161kol\u00e1ch. Nab\u00edz\u00ed v\u00edce ne\u017e 140 hodin p\u0159ipraven\u00fdch materi\u00e1l\u016f, miniher, kv\u00edz\u016f i kompletn\u011b p\u0159ipraven\u00e9 hodiny, kter\u00e9 u\u010ditel\u016fm \u0161et\u0159\u00ed \u010das a \u017e\u00e1k\u016fm p\u0159ibl\u00ed\u017euj\u00ed slo\u017eit\u00e1 t\u00e9mata z\u00e1bavnou a praktickou formou.',
      },
      {
        type: 'paragraph',
        text: 'O tom, pro\u010d Skoala vznikla a jak ji mohou u\u010ditel\u00e9 za\u010d\u00edt vyu\u017e\u00edvat hned z\u00edtra, jsme mluvili s Dagmar Biersakovou, specialistkou rozvoje pedagog\u016f ve finan\u010dn\u00edm vzd\u011bl\u00e1v\u00e1n\u00ed a projektovou mana\u017eerkou programu.',
      },
      {
        type: 'heading',
        text: 'P\u0159edstavila byste pros\u00edm Skoalu v jedné minut\u011b? Co platforma d\u011bl\u00e1 a jak\u00fd probl\u00e9m ve \u0161kol\u00e1ch \u0159e\u0161\u00ed?',
      },
      {
        type: 'paragraph',
        text: 'Skoala je digit\u00e1ln\u00ed a interaktivn\u00ed n\u00e1stroj finan\u010dn\u00edho vzd\u011bl\u00e1v\u00e1n\u00ed pro z\u00e1kladn\u00ed a st\u0159edn\u00ed \u0161koly. Zdarma nab\u00edz\u00ed v\u00edce ne\u017e 140 hodin v\u00fdukových materi\u00e1l\u016f, kter\u00e9 jsou ur\u010deny p\u0159edev\u0161\u00edm pro u\u010ditele, ale mohou je vyu\u017e\u00edt i rodi\u010de nebo dal\u0161\u00ed lid\u00e9 pracuj\u00edc\u00ed s d\u011btmi. Obsahuje z\u00e1bavn\u00e9 minihrY, skupinov\u00e9 projekty, videa i kompletn\u011b p\u0159ipraven\u00e9 hodiny, d\u00edky nim\u017e se finan\u010dn\u00ed t\u00e9mata st\u00e1vaj\u00ed pro \u017e\u00e1ky srozumiteln\u00e1 a praktick\u00e1.',
      },
      {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1733878859985-9833d85629a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXRoZW1hdGljcyUyMHdvcmtib29rJTIwc3R1ZHklMjBub3RlYm9vayUyMGNvbG9yZnVsfGVufDF8fHx8MTc3MjM1NzQ5NXww&ixlib=rb-4.1.0&q=80&w=900',
        alt: 'V\u00fduka finan\u010dn\u00ed gramotnosti',
        caption: 'Interaktivn\u00ed materi\u00e1ly Skoaly jsou zdarma pro v\u0161echny \u010desk\u00e9 \u0161koly.',
      },
      {
        type: 'heading',
        text: 'Co byl hlavn\u00ed impuls ke vzniku Skoaly a kdo st\u00e1l u jej\u00edho zrodu?',
      },
      {
        type: 'paragraph',
        text: 'Ke vzniku Skoaly vedlo hned n\u011bkolik d\u016fvod\u016f. Pat\u0159ila mezi n\u011b stagnuj\u00edc\u00ed \u00farove\u0148 finan\u010dn\u00ed gramotnosti ve spole\u010dnosti i nejednotn\u00fd syst\u00e9m v\u00fduky finan\u010dn\u00edch t\u00e9mat na \u0161kol\u00e1ch, p\u0159esto\u017ee jsou od roku 2013 sou\u010d\u00e1st\u00ed r\u00e1mcov\u00fdch vzd\u011bl\u00e1vac\u00edch pl\u00e1n\u016f. Finan\u010dn\u00ed t\u00e9mata se vyu\u010duj\u00ed r\u016fzn\u011b. N\u011bkde jsou za\u010dlenn\u011bna nap\u0159\u00ed\u010d p\u0159edm\u011bty, jinde existuje samostatn\u00fd p\u0159edm\u011bt.',
      },
      {
        type: 'quote',
        text: 'Finan\u010dn\u00ed gramotnost nen\u00ed jen o \u010d\u00edslech \u2014 je o rozhodov\u00e1n\u00ed, hodnotov\u00e9m uvažov\u00e1n\u00ed a schopnosti \u017e\u00edt zodpov\u011bdn\u011b.',
        author: 'Dagmar Biersakov\u00e1, Skoala',
      },
      {
        type: 'paragraph',
        text: 'C\u00edlem Skoaly je sjednotit roztr\u00ed\u0161t\u011bn\u00fd syst\u00e9m v\u00fduky finan\u010dn\u00edch t\u00e9mat a poskytnout pedagog\u016fm v\u0161e pot\u0159ebn\u00e9 na jednom m\u00edst\u011b. Nejde ale jen o znalosti \u2013 Skoala rozv\u00edj\u00ed i kl\u00ed\u010dov\u00e9 dovednosti, jako je kritick\u00e9 my\u0161len\u00ed, t\u00fdmov\u00e1 spolupr\u00e1ce, schopnost \u0159e\u0161it probl\u00e9my, odolnost \u010di sebev\u011bdom\u00ed. U\u010d\u00ed \u017e\u00e1ky nejen v\u011bd\u011bt, co je nap\u0159\u00edklad reklamace, ale tak\u00e9 um\u011bt ji skute\u010dn\u011b prov\u00e9st.',
      },
    ],
  },
  {
    id: '2',
    slug: 'algoritmy-a-ai-meni-deti',
    title: 'Rozhovor s Josefem Hol\u00fdm: Jak algoritmy a AI m\u011bn\u00ed d\u011bti i \u0161kolstv\u00ed a pro\u010d nesta\u010d\u00ed jen zak\u00e1zat mobily',
    excerpt:
      'Soci\u00e1ln\u00ed s\u00edt\u011b, doporu\u010dovac\u00ed algoritmy a um\u011bl\u00e1 inteligence z\u00e1sadn\u011b prom\u011b\u0148uj\u00ed zp\u016fsob, jak\u00fdm d\u011bti p\u0159em\u00fd\u0161lej\u00ed, u\u010d\u00ed se a komunikuj\u00ed. Z platforem ur\u010den\u00fdch p\u016fvodn\u011b k z\u00e1bav\u011b se staly n\u00e1stroje, kter\u00e9 formuj\u00ed psychiku i hodnoty cel\u00e9 generace.',
    author: 'Vividbooks redakce',
    date: '3. \u00fanora 2026',
    readTime: 10,
    category: 'Rozhovor',
    coverImage:
      'https://images.unsplash.com/photo-1767954561407-7014cb8fb16c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxBSSUyMHRlY2hub2xvZ3klMjBjaGlsZHJlbiUyMGVkdWNhdGlvbiUyMGRpZ2l0YWwlMjBsZWFybmluZ3xlbnwxfHx8fDE3NzIzNTc0ODh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    content: [
      {
        type: 'paragraph',
        text: 'Soci\u00e1ln\u00ed s\u00edt\u011b, doporu\u010dovac\u00ed algoritmy a um\u011bl\u00e1 inteligence z\u00e1sadn\u011b prom\u011b\u0148uj\u00ed zp\u016fsob, jak\u00fdm d\u011bti p\u0159em\u00fd\u0161lej\u00ed, u\u010d\u00ed se a komunikuj\u00ed. Z platforem ur\u010den\u00fdch p\u016fvodn\u011b k z\u00e1bav\u011b se staly n\u00e1stroje, kter\u00e9 formuj\u00ed psychiku i hodnoty cel\u00e9 generace.',
      },
      {
        type: 'paragraph',
        text: 'Podle odborn\u00edk\u016f, jako je Josef Hol\u00fd z podcastu Kan\u00e1rci v s\u00edti, stoj\u00edme dnes p\u0159ed z\u00e1sadn\u00ed ot\u00e1zkou: Jak d\u011bti p\u0159ed negativn\u00edmi dopady chr\u00e1nit a z\u00e1rove\u0148 je p\u0159ipravit na sv\u011bt, kde technologie nikdy nezmiz\u00ed?',
      },
      {
        type: 'heading',
        text: 'Pro\u010d nesta\u010d\u00ed mobily ve \u0161kol\u00e1ch prost\u011b zak\u00e1zat?',
      },
      {
        type: 'paragraph',
        text: 'Z\u00e1kaz je nejjednodu\u017e\u0161\u00ed a zdej\u0161\u00ed \u0159e\u0161en\u00ed. Ale funguje to asi stejn\u011b jako zak\u00e1zat d\u011btem sladkosti. Pokud jim nep\u0159edstav\u00edme alternativy a nau\u010d\u00edme je rozum\u011bt tomu, co se v n\u011b d\u011bje, z\u00e1kaz situaci jen odlo\u017e\u00ed. Jakmile p\u0159ijdou dom\u016f nebo dosp\u011bj\u00ed, jsou bez ochrany.',
      },
      {
        type: 'quote',
        text: 'D\u00edg\u00edt\u00e1ln\u00ed gramotnost by m\u011bla b\u00fdt stejn\u011b samoz\u0159ejm\u00e1 jako um\u011bt \u010d\u00edst a po\u010d\u00edtat.',
        author: 'Josef Hol\u00fd',
      },
      {
        type: 'heading',
        text: 'Co mohou udělat u\u010ditel\u00e9 ji\u017e dnes?',
      },
      {
        type: 'paragraph',
        text: 'Zabudovat digit\u00e1ln\u00ed gramotnost p\u0159\u00edmo do b\u011b\u017en\u00e9 v\u00fduky. Nab\u00eddn\u00e9 \u017e\u00e1k\u016fm \u00fakoly, p\u0159i kter\u00fdch analyzuj\u00ed, jak funguje doporu\u010dovac\u00ed syst\u00e9m, pro\u010d n\u011bkter\u00e9 p\u0159\u00edsp\u011bvky vid\u00ed v\u00edce ne\u017e jin\u00e9, nebo jak rozpoznat manipulativn\u00ed obsah.',
      },
      {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1692132200009-ed25d3e169f9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaHlzaWNzJTIwc2NpZW5jZSUyMGV4cGVyaW1lbnQlMjBzY2hvb2wlMjBvdXRkb29yJTIwbmF0dXJlfGVufDF8fHx8MTc3MjM1NzQ5NXww&ixlib=rb-4.1.0&q=80&w=900',
        alt: 'Digit\u00e1ln\u00ed vzd\u011bl\u00e1v\u00e1n\u00ed',
        caption: 'Modern\u00ed v\u00fduka vy\u017eaduje nov\u00e9 p\u0159\u00edstupy k technologi\u00edm.',
      },
      {
        type: 'paragraph',
        text: 'Dobr\u00e9 zpr\u00e1vy jsou, \u017ee d\u011bti jsou schopn\u00e9 kr\u00edticky p\u0159em\u00fd\u0161let o technologi\u00edch daleko v\u00edce, ne\u017e \u010dasto p\u0159edpokl\u00e1d\u00e1me. Pot\u0159ebuj\u00ed jen n\u011bkoho, kdo jim uk\u00e1\u017ee jak.',
      },
    ],
  },
  {
    id: '3',
    slug: 'pribeh-tridy-ktera-vyrostla-s-vividbooks',
    title: 'P\u0159\u00edb\u011bh t\u0159\u00eddy, kter\u00e1 vyrostla s Vividbooks',
    excerpt:
      'Va\u017een\u00ed u\u010ditel\u00e9 a \u0159editel\u00e9, dovolte mi tentokr\u00e1t napsat n\u011bco osobn\u011bj\u0161\u00edho.',
    author: 'Radka Novakovsk\u00e1',
    date: '20. ledna 2026',
    readTime: 6,
    category: 'P\u0159\u00edb\u011bhy u\u010ditel\u016f',
    coverImage:
      'https://images.unsplash.com/photo-1746513534315-caa52d3f462c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWlsaW5nJTIwZmVtYWxlJTIwdGVhY2hlciUyMHBvcnRyYWl0JTIwc2Nob29sfGVufDF8fHx8MTc3MjM1NzQ4OHww&ixlib=rb-4.1.0&q=80&w=1080',
    content: [
      {
        type: 'paragraph',
        text: 'Va\u017een\u00ed u\u010ditel\u00e9 a \u0159editel\u00e9, dovolte mi tentokr\u00e1t napsat n\u011bco osobn\u011bj\u0161\u00edho.',
      },
      {
        type: 'paragraph',
        text: 'U\u010d\u00edm matematiku na Z\u0160 Pod Jasany u\u017e p\u011bt let. Kdy\u017e jsem p\u0159ed t\u0159emi lety za\u010dala pou\u017e\u00edvat Vividbooks pracovn\u00ed se\u0161ity, upot\u0159\u00edmn\u011b jsem nev\u011bdla, co o\u010dek\u00e1vat. M\u011bla jsem obavy, jestli \u017e\u00e1ci p\u0159ijmou jin\u00fd form\u00e1t ne\u017e kl\u00e1sick\u00e9 u\u010debnice.',
      },
      {
        type: 'heading',
        text: 'Prvn\u00ed hodina s Vividbooks',
      },
      {
        type: 'paragraph',
        text: 'Vzpom\u00edn\u00e1m si, jak \u017e\u00e1ci otev\u0159eli se\u0161ity a zmlkli. Ne z nudy, ale ze s\u00fast\u0159ed\u011bn\u00ed. Barevn\u00e9 ilustrace, srozumiteln\u00fd text, \u00fakoly, kter\u00e9 n\u00e1vod na probl\u00e9m neprozrad\u00ed hned, ale nechaj\u00ed je dom\u00fd\u0161let \u2014 to byl obrovsk\u00fd posun.',
      },
      {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1557734864-c78b6dfef1b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmltYXJ5JTIwc2Nob29sJTIwa2lkcyUyMHRlYW13b3JrJTIwY2xhc3Nyb29tJTIwaGFwcHl8ZW58MXx8fHwxNzcyMzU3NDk0fDA&ixlib=rb-4.1.0&q=80&w=900',
        alt: 'D\u011bti ve t\u0159\u00edd\u011b',
        caption: '\u017d\u00e1ci se u\u010d\u00ed spoluprac\u00edvat a p\u0159em\u00fd\u0161let.',
      },
      {
        type: 'quote',
        text: 'Nesetk\u00e1vala jsem se s t\u00edm, \u017ee by se d\u011bti nudily. Naopak\u00a0\u2014 pt\u00e1valy se, co bude dal\u0161\u00ed hodinu.',
        author: 'Radka Novakovsk\u00e1, u\u010ditelka matematiky',
      },
      {
        type: 'heading',
        text: 'Jak to vypad\u00e1 dnes?',
      },
      {
        type: 'paragraph',
        text: 'T\u0159\u00edda, se kterou jsem Vividbooks za\u010d\u00ednala, je dnes v devat\u00e9. T\u0159\u00edd\u00e1. Z\u00e1v\u011bre\u010dn\u00e9 zkou\u0161ky? Nejlep\u0161\u00ed v historii \u0161koly. A co v\u00edce \u2014 \u017e\u00e1ci um\u00ed pojmenovat, pro\u010d n\u011bco plat\u00ed, ne jen jak\u00e9 je v\u00fdsledky. To je, mysl\u00edm, skute\u010dn\u00e9 vzd\u011bl\u00e1n\u00ed.',
      },
    ],
  },
  {
    id: '4',
    slug: 'fyzika-na-zamku',
    title: 'Jak se u\u010d\u00ed fyzika na z\u00e1mku: v\u00fdlet, kter\u00fd \u017e\u00e1ci nikdy nezapomenou',
    excerpt:
      'U\u010ditelka fyziky Hana \u0160vec\u00e1 vzala sv\u00e9 \u017e\u00e1ky na jednodenni v\u00fdlet do z\u00e1meckého parku. Co zn\u011b vypadalo jako zl\u00e9t n\u00e1pad, se stalo nejlep\u0161\u00ed hodinou roku.',
    author: 'Hana \u0160vec\u00e1',
    date: '8. ledna 2026',
    readTime: 7,
    category: 'P\u0159\u00edb\u011bhy u\u010ditel\u016f',
    coverImage:
      'https://images.unsplash.com/photo-1692132200009-ed25d3e169f9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaHlzaWNzJTIwc2NpZW5jZSUyMGV4cGVyaW1lbnQlMjBzY2hvb2wlMjBvdXRkb29yJTIwbmF0dXJlfGVufDF8fHx8MTc3MjM1NzQ5NXww&ixlib=rb-4.1.0&q=80&w=1080',
    content: [
      {
        type: 'paragraph',
        text: 'Kdy\u017e jsem sv\u00fdm \u017e\u00e1k\u016fm \u0159ekla, \u017ee fyziku bud eme u\u010dit v z\u00e1meckém parku, m\u00edstn\u00ed hv\u011bzdn\u00ed \u017e\u00e1k si \u00faptav\u011b klikl na pero. D\u011bti, kter\u00e9 se b\u011b\u017en\u011b fyzice vyhnou, v\u0161ak najednou chv\u011btaly vzr\u0161en\u00edm.',
      },
      {
        type: 'heading',
        text: 'Fyzika v\u017edy \u017eila kolem n\u00e1s',
      },
      {
        type: 'paragraph',
        text: 'V z\u00e1meckém parku jsme m\u011b\u0159ili v\u00fd\u0161ku strom\u016f pomoc\u00ed st\u00edn\u016f, po\u010d\u00edtali d\u00e9lku kyvadla a studovali pohyb vody ve fontán\u011b. Fyzika najednou d\u00e1vala smysl, proto\u017ee jsme ji vidoeli na vlastn\u00ed o\u010di.',
      },
      {
        type: 'quote',
        text: 'Kdy\u017e \u017e\u00e1k sám z\u00e1\u017e\u00edje fyzik\u00e1ln\u00ed jev, nikdy ho nezapomene.',
        author: 'Hana \u0160vec\u00e1',
      },
      {
        type: 'paragraph',
        text: 'Pr\u00e1ce s Vividbooks digit\u00e1ln\u00ed u\u010debnic\u00ed pak do \u0161koly p\u0159inesla p\u0159irozen\u00e9 navazan\u00ed \u2014 \u017e\u00e1ci s nadšen\u00edm vyhled\u00e1vali, jak jsou pojmy, kter\u00e9 za\u017eili venku, vysv\u011btlen\u00e9 digit\u00e1ln\u011b.',
      },
    ],
  },
];