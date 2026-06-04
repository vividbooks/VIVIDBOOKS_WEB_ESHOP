export interface NovinkaPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: number;
  category: string;
  bgColor?: string;       // barva pozadí dlaždice
  coverImage?: string;    // volitelný obrázek přes celou dlaždici
  tileText?: string;      // velký text zobrazený na dlaždici (např. "10%")
  content: NovinkaBlock[];
  contentHtml?: string;   // rich HTML z editoru (odkazy, formátování)
}

export type NovinkaBlock =
  | { type: 'paragraph'; text: string; html?: string }
  | { type: 'heading'; text: string; html?: string }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'quote'; text: string; author?: string; html?: string };

export const NOVINKA_POSTS: NovinkaPost[] = [
  {
    id: '1',
    slug: 'nova-ucebnice-matematiky-6-rocnik',
    title: 'Nov\u00e1 digit\u00e1ln\u00ed u\u010debnice matematiky pro 6. ro\u010dn\u00edk',
    excerpt:
      'S pot\u011b\u0161en\u00edm oznamujeme, \u017ee na\u0161e nov\u00e1 digit\u00e1ln\u00ed u\u010debnice matematiky pro 6. ro\u010dn\u00edk je nyn\u00ed dostupn\u00e1 v aplikaci Vividbooks. P\u0159in\u00e1\u0161\u00ed interaktivn\u00ed cvi\u010den\u00ed, animace a okam\u017eitou zp\u011btnou vazbu.',
    author: 'Vividbooks t\u00fdm',
    date: '28. \u00fanora 2026',
    readTime: 3,
    category: 'Nov\u00e9 produkty',
    bgColor: '#F07B6A',
    tileText: 'Nov\u00e1\nu\u010debnice',
    content: [
      { type: 'paragraph', text: 'S pot\u011b\u0161en\u00edm oznamujeme, \u017ee na\u0161e nov\u00e1 digit\u00e1ln\u00ed u\u010debnice matematiky pro 6. ro\u010dn\u00edk je nyn\u00ed dostupn\u00e1 v aplikaci Vividbooks. U\u010debnice p\u0159in\u00e1\u0161\u00ed interaktivn\u00ed cvi\u010den\u00ed, animace a okam\u017eitou zp\u011btnou vazbu pro \u017e\u00e1ky.' },
      { type: 'heading', text: 'Co u\u010debnice obsahuje?' },
      { type: 'paragraph', text: 'U\u010debnice pokr\u00fdv\u00e1 cel\u00fd u\u010debn\u00ed pl\u00e1n pro 6. ro\u010dn\u00edk z\u00e1kladn\u00ed \u0161koly. Ka\u017ed\u00e1 lekce m\u00e1 jasnou strukturu: \u00favod, v\u00fdklad, uk\u00e1zkov\u00e9 p\u0159\u00edklady a sadu interaktivn\u00edch \u00faloh. U\u010ditel\u00e9 mohou sledovat pokrok \u017e\u00e1k\u016f v re\u00e1ln\u00e9m \u010dase.' },
      { type: 'quote', text: 'Kone\u010dn\u011b u\u010debnice, kter\u00e1 bav\u00ed d\u011bti i u\u010ditele z\u00e1rove\u0148.', author: 'U\u010ditelka Z\u0160 Brno' },
      { type: 'paragraph', text: 'U\u010debnici si m\u016f\u017eete vyzkou\u0161et zdarma po dobu 30 dn\u00ed. Sta\u010d\u00ed se p\u0159ihl\u00e1sit do aplikace Vividbooks a vybrat t\u0159\u00eddu.' },
    ],
  },
  {
    id: '2',
    slug: 'vividboard-aktualizace-jaro-2026',
    title: 'Vividboard: velk\u00e1 aktualizace na jaro 2026',
    excerpt:
      'Vividboard z\u00edskal \u0159adu nov\u00fdch funkc\u00ed \u2014 sd\u00edlen\u00ed tabule v re\u00e1ln\u00e9m \u010dase, nov\u00e9 \u0161ablony pro matematiku a p\u0159\u00edrodov\u011bdn\u00e9 p\u0159edm\u011bty a vylep\u0161en\u00e9 export do PDF.',
    author: 'Produktov\u00fd t\u00fdm',
    date: '20. \u00fanora 2026',
    readTime: 4,
    category: 'Aktualizace',
    bgColor: '#C8D4F0',
    content: [
      { type: 'paragraph', text: 'Vividboard, na\u0161e digit\u00e1ln\u00ed interaktivn\u00ed tabule, pro\u0161la velkou aktualizac\u00ed. P\u0159in\u00e1\u0161\u00edme v\u00e1m p\u0159ehled nejd\u016fle\u017eit\u011bj\u0161\u00edch zm\u011bn.' },
      { type: 'heading', text: 'Sd\u00edlen\u00ed v re\u00e1ln\u00e9m \u010dase' },
      { type: 'paragraph', text: 'N\u011bkolik u\u010ditel\u016f m\u016f\u017ee nyn\u00ed pracovat na stejn\u00e9 tabuli sou\u010dasn\u011b. To je ide\u00e1ln\u00ed pro spolupracuj\u00edc\u00ed u\u010ditele nebo pro \u017e\u00e1ky pracuj\u00edc\u00ed ve skupin\u00e1ch.' },
      { type: 'heading', text: 'Nov\u00e9 \u0161ablony' },
      { type: 'paragraph', text: 'P\u0159idali jsme des\u00edtky nov\u00fdch \u0161ablon pro matematiku, fyziku, chemii a p\u0159\u00edrodopis.' },
    ],
  },
  {
    id: '3',
    slug: 'dvpp-webinare-jaro-2026',
    title: 'DVPP webin\u00e1\u0159e \u2013 jaro 2026: p\u0159ihl\u00e1\u0161ky otev\u0159eny',
    excerpt:
      'Spou\u0161t\u00edme registrace na DVPP webin\u00e1\u0159e pro jarn\u00ed s\u00e9rii 2026. T\u00e9mata: interaktivn\u00ed v\u00fduka, pr\u00e1ce s digit\u00e1ln\u00edm obsahem a motivace \u017e\u00e1k\u016f.',
    author: 'Vzd\u011bl\u00e1vac\u00ed t\u00fdm',
    date: '10. \u00fanora 2026',
    readTime: 2,
    category: 'Vzd\u011bl\u00e1v\u00e1n\u00ed',
    bgColor: '#001161',
    tileText: 'DVPP\nWebin\u00e1\u0159e',
    content: [
      { type: 'paragraph', text: 'Otev\u00edr\u00e1me registrace na DVPP webin\u00e1\u0159e pro jarn\u00ed s\u00e9rii 2026. Webin\u00e1\u0159e jsou akreditovan\u00e9 M\u0160MT a jsou zdarma pro u\u010ditele, kte\u0159\u00ed vyu\u017e\u00edvaj\u00ed produkty Vividbooks.' },
      { type: 'heading', text: 'Pl\u00e1novan\u00e1 t\u00e9mata' },
      { type: 'paragraph', text: 'Bude se konat p\u011bt webin\u00e1\u0159\u016f: Interaktivn\u00ed v\u00fduka s Vividbooks, Pr\u00e1ce s digit\u00e1ln\u00edm obsahem, Motivace \u017e\u00e1k\u016f, Hodnocen\u00ed v digit\u00e1ln\u00ed dob\u011b a Sp\u00e1nek a koncentrace \u017e\u00e1k\u016f. Ka\u017ed\u00fd webin\u00e1\u0159 trv\u00e1 90 minut.' },
      { type: 'quote', text: 'Webin\u00e1\u0159e Vividbooks jsou praktick\u00e9, ne te\u00f3rie. Odnesu si v\u017edy n\u011bco, co hned vyu\u017eiji.', author: 'U\u010ditelka Z\u0160 Praha' },
    ],
  },
  {
    id: '4',
    slug: 'spoluprace-s-ministerstvem',
    title: 'Vividbooks spolupracuje s Ministerstvem \u0161kolstv\u00ed na digit\u00e1ln\u00ed transformaci',
    excerpt:
      'Vividbooks se stalo jednou z partnerskych organizac\u00ed projektu digit\u00e1ln\u00ed transformace z\u00e1kladn\u00edch \u0161kol. V r\u00e1mci projektu z\u00edsk\u00e1 v\u00edce ne\u017e 500 \u0161kol bezplatn\u00fd p\u0159\u00edstup k na\u0161im u\u010debnic\u00edm.',
    author: 'Vividbooks t\u00fdm',
    date: '3. \u00fanora 2026',
    readTime: 3,
    category: 'Partnerství',
    bgColor: '#F5D645',
    tileText: '500+\n\u0161kol',
    content: [
      { type: 'paragraph', text: 'Jsme hrd\u00ed, \u017ee Vividbooks bylo vybr\u00e1no jako partner projektu digit\u00e1ln\u00ed transformace z\u00e1kladn\u00edch \u0161kol, kter\u00fd zaji\u0161\u0165uje Ministerstvo \u0161kolstv\u00ed, ml\u00e1de\u017ee a t\u011blov\u00fdchovy.' },
      { type: 'heading', text: 'Co to znamen\u00e1 pro \u0161koly?' },
      { type: 'paragraph', text: 'V r\u00e1mci projektu z\u00edsk\u00e1 v\u00edce ne\u017e 500 z\u00e1kladn\u00edch \u0161kol bezplatn\u00fd p\u0159\u00edstup k digit\u00e1ln\u00edm u\u010debnic\u00edm Vividbooks na dobu dvou let.' },
    ],
  },
];