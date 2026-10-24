/**
 * Pilotáž matematiky 2026/27 — microsite akce z webináře.
 *
 * Nabídka: digitální matematika (1. i 2. stupeň) zdarma do konce školního roku 2026/27 a k tomu
 * 20 % sleva na pracovní sešity matematiky. Přihlášky do 31. 12. 2026.
 *
 * Přihláška jde přes Edge funkci `kabinet-trial` do Kabinetu jako běžný trial z webu
 * s poznámkou PILOT_NOTE — škola dostane přístup hned a podle poznámky ho v Kabinetu
 * prodloužíme do konce školního roku. Žádosti odmítnuté Kabinetem (škola už má trial nebo předplatné)
 * se v Kabinetu zapíšou se stejnou poznámkou, takže je lze dohledat a vyřídit ručně.
 *
 * Formulář začíná otázkou „Má vaše škola Vividbooks?“: Ano → školu najdeme podle e-mailu
 * (`/pilot/school-lookup`), Ne → přihláška školy. V obou cestách jde rovnou pozvat kolegy
 * (`/pilot/invite`, server `pilotInvites.ts`); kdo školu přihlásit nemůže, pošle tip.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Loader2, ShoppingCart } from 'lucide-react';
import { SEOHead, faqJsonLd } from './SEOHead';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SubjectTabsSection } from './SubjectTabsSection';
import { MathVoicedVideos } from './MathInteractiveIncluded';
/** Skutečné záběry listů na tabuli (z nahrávek aplikace v public/matematika-ukazka). */
import imgPracovniListy from '../assets/campaign/pracovni-listy-ukazka.webp';
import { YouTubePlaylistSlider } from './YouTubePlaylistSlider';
import { MATH_CAMPAIGN_WEBINAR_VIDEOS } from '../data/mathCampaignWebinarVideos';
import { MATH_METHODOLOGY_PLAYLIST_URL, MATH_METHODOLOGY_PLAYLIST_VIDEOS } from '../data/mathMethodologyYoutubePlaylist';
import { getProductImage } from './cartUpsellUtils';
import { useProducts } from '../contexts/ProductsContext';
import { useCart } from '../contexts/CartContext';
import { buildBundleCartLines, isProductBundleActiveAt, type ProductBundleRecord } from '../utils/bundlePricing';
import { productDetailPath } from '../utils/slugify';
import { formatTypography } from '../utils/formatTypography';
import { isValidEmailFormat, EMAIL_FORMAT_HINT_CS } from '../utils/emailValidation';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import {
  ColleaguesField,
  DEFAULT_INVITE_MESSAGE,
  InviteResultList,
  MessageField,
  lookupSchool,
  sendInvites,
  type InviteResult,
  type SchoolLookup,
} from './pilotFormParts';
import { MATEMATIKA_2_TAB_OVERRIDES } from '../data/matematika2SubjectTabOverrides';
import {
  MATH2_ECOSYSTEM_EXCLUDED_TABS,
  VividLogo,
} from './MathCampaignLandingPage';

const FF = "'Fenomen Sans', sans-serif";
/** Nadpisy pilotáže v Fenomen Sans (Vítek 16. 10. 2026), ne v Cooper jako kampaň matematiky. */
/** Jen hlavní nadpis v hero (Vítek 16. 10. 2026). */
const COOPER = "'Cooper Light', serif";
const HEADING: React.CSSProperties = { fontFamily: FF, fontWeight: 700, letterSpacing: '-0.01em' };

const PILOT_NOTE = 'Pilotáž matematiky 2026/27 (zdarma do konce školního roku, 20 % na sešity)';
const DEADLINE_LABEL = '31. 12. 2026';
const DISCOUNT = 0.2;
const PAGE_PATH = '/matematika-pilotovani';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const KABINET_TRIAL_FN = `https://${projectId}.supabase.co/functions/v1/kabinet-trial`;

const POSITIONS = ['Učitel/ka', 'Ředitel/ka', 'Zástupce/kyně ředitele', 'Metodik/čka', 'Jiné'];

type Product = {
  id?: string;
  name?: string;
  category?: string;
  type?: string;
  price?: string;
  image?: string;
};

/* ─────────────────────────── sešity a ceny ─────────────────────────── */

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function priceKc(product: Product): number | null {
  const n = Number.parseInt(String(product.price ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function discounted(price: number) {
  return Math.round(price * (1 - DISCOUNT));
}

function formatKc(n: number) {
  return `${n.toLocaleString('cs-CZ')} Kč`;
}

function gradeOf(product: Product): number {
  const name = String(product.name ?? '');
  const m = name.match(/(\d+)\.\s*ro[cč]n/i);
  const n = Number.parseInt(m?.[1] ?? '', 10);
  return Number.isFinite(n) ? n : 99;
}

function partOf(product: Product): number {
  const name = normalize(product.name);
  if (name.includes('pocetnicek')) return 9;
  const m = name.match(/(\d+)\.\s*dil/);
  const n = Number.parseInt(m?.[1] ?? '', 10);
  return Number.isFinite(n) ? n : 5;
}

type Series = {
  id: string;
  title: string;
  subtitle: string;
  match: (p: Product) => boolean;
  tone: { card: string; border: string; chip: string };
};

const isMathWorkbook = (p: Product) =>
  p.type === 'workbook' && normalize(p.category).includes('matematika') && !!getProductImage(p);

const SERIES: Series[] = [
  {
    id: 'prvni-stupen',
    title: '1. stupeň',
    subtitle: 'Pracovní sešity a Početníček pro 1. a 2. ročník',
    match: (p) => isMathWorkbook(p) && normalize(p.category).includes('1. stupen'),
    tone: { card: 'bg-[#fff7ed]', border: 'border-[#f5a623]/30', chip: 'bg-[#f5a623]' },
  },
  {
    id: 'pro-vsechny',
    title: 'Pro všechny',
    subtitle: '6.–9. ročník · hutnější řada pro procvičování a automatizaci',
    match: (p) => isMathWorkbook(p) && normalize(p.category).includes('2. stupen') && normalize(p.name).includes('pro vsechny'),
    tone: { card: 'bg-[#f3eeff]', border: 'border-[#7C3AED]/28', chip: 'bg-[#7C3AED]' },
  },
  {
    id: 'krok',
    title: 'Krok za krokem',
    subtitle: '6.–9. ročník · řada pro vyvozování nové látky po malých krocích',
    match: (p) => isMathWorkbook(p) && normalize(p.category).includes('2. stupen') && normalize(p.name).includes('krok za krokem'),
    tone: { card: 'bg-[#ecfdf5]', border: 'border-[#059669]/28', chip: 'bg-[#059669]' },
  },
];

function sortWorkbooks(a: Product, b: Product) {
  return gradeOf(a) - gradeOf(b) || partOf(a) - partOf(b);
}

/** Sady na ročník: všechny díly řady pro daný ročník. */
function setsByGrade(books: Product[]) {
  const map = new Map<number, Product[]>();
  for (const b of books) {
    const g = gradeOf(b);
    if (g === 99) continue;
    map.set(g, [...(map.get(g) ?? []), b]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([grade, items]) => {
      const sorted = [...items].sort(sortWorkbooks);
      const full = sorted.reduce((sum, p) => sum + (priceKc(p) ?? 0), 0);
      return { grade, items: sorted, full, pilot: sorted.reduce((sum, p) => sum + discounted(priceKc(p) ?? 0), 0) };
    });
}

function shortTitle(product: Product) {
  const name = String(product.name ?? '');
  if (normalize(name).includes('pocetnicek')) return 'Početníček';
  const part = name.match(/(\d+)\.\s*d[ií]l/i);
  return part ? `${part[1]}. díl` : name;
}

/* ─────────────────────────── drobné stavební prvky ─────────────────────────── */

function SectionTitle({
  eyebrow,
  title,
  body,
  dark = false,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Světlé písmo na tmavém pozadí sekce. */
  dark?: boolean;
}) {
  return (
    <div className="mx-auto mb-9 max-w-[760px] text-center">
      {eyebrow ? (
        <p className={`mb-2 text-[12px] font-bold uppercase tracking-[0.14em] ${dark ? 'text-[#C4B5FD]' : 'text-[#001161]/40'}`} style={{ fontFamily: FF }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className={`text-[28px] leading-[1.08] md:text-[38px] ${dark ? 'text-white' : 'text-[#001161]'}`} style={HEADING}>
        {typeof title === 'string' ? formatTypography(title) : title}
      </h2>
      {body ? (
        <p className={`mx-auto mt-3 max-w-[640px] text-[15px] leading-relaxed md:text-[16px] ${dark ? 'text-white/70' : 'text-[#001161]/65'}`} style={{ fontFamily: FF }}>
          {typeof body === 'string' ? formatTypography(body) : body}
        </p>
      ) : null}
    </div>
  );
}

function PrimaryButton({ href, children, small = false }: { href: string; children: React.ReactNode; small?: boolean }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center rounded-xl bg-[#7C3AED] font-bold text-white transition hover:scale-[1.03] hover:bg-[#6D28D9] ${
        small ? 'whitespace-nowrap px-3.5 py-2 text-[13px]' : 'px-6 py-3.5 text-[16px] shadow-sm'
      }`}
      style={{ fontFamily: FF }}
    >
      {children}
    </a>
  );
}

/** Vějíř obálek v hero — po jedné obálce z každého ročníku, 1. až 9. */
function HeroCovers({ books }: { books: Product[] }) {
  const picks = useMemo(() => {
    const seen = new Set<string>();
    return [...books]
      .sort(sortWorkbooks)
      .filter((b) => {
        const key = `${gradeOf(b)}-${normalize(b.name).includes('krok') ? 'k' : 'p'}`;
        if (seen.has(key) || partOf(b) !== 1) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 9);
  }, [books]);

  if (picks.length === 0) return <div className="h-[220px] md:h-[260px]" />;

  const mid = (picks.length - 1) / 2;
  return (
    <div className="relative -mx-4 flex h-[220px] items-end justify-center overflow-hidden sm:-mx-6 md:mx-auto md:h-[270px] md:max-w-[980px]">
      {picks.map((book, i) => {
        const offset = i - mid;
        return (
          <div
            key={String(book.id ?? i)}
            className="relative shrink-0 origin-bottom"
            style={{
              marginLeft: i === 0 ? 0 : -34,
              transform: `rotate(${offset * 4.5}deg) translateY(${Math.abs(offset) * 9}px)`,
              zIndex: 20 - Math.round(Math.abs(offset)),
            }}
          >
            <ImageWithFallback
              src={getProductImage(book)}
              alt={book.name ?? 'Pracovní sešit matematiky'}
              className="object-contain"
              style={{ width: 128, height: 190, filter: 'drop-shadow(0 4px 10px rgba(0, 17, 97, 0.16))' }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── sekce ─────────────────────────── */

/* ─────────────────────────── interaktivní verze a aplikace ─────────────────────────── */

const APP_ORIGIN = 'https://nove.vividbooks.com';
const APP_ICON_STORAGE = 'https://qypiuvqglsmxdsnyazih.supabase.co/storage/v1/object/public/platform-admin/covers';

const USES = [
  {
    title: 'Tisknete',
    body: 'Pracovní listy, procvičování i písemky si vytisknete pro celou třídu, kdykoli je potřebujete.',
  },
  {
    title: 'Promítáte na tabuli',
    body: 'Výklad, úlohy i aplikace pustíte na interaktivní tabuli nebo projektor a pracujete s nimi přímo v hodině.',
  },
  {
    title: 'Žáci pracují sami',
    body: 'Žáci si s kódem školy otevřou učebnici, procvičování i aplikace na tabletu nebo počítači, ve škole i doma.',
  },
];

type PilotApp = { name: string; body: string; icon: string; stage: string };

/** Aplikace, které učitel v pilotáži najde v knihovně u matematiky (stav hlavní aplikace k 16. 10. 2026). */
const MATH_APPS: PilotApp[] = [
  {
    name: 'Početník',
    body: 'Generuje příklady k procvičení počítání. Nastavíte téma a obtížnost, žáci počítají na tabletu nebo z tisku.',
    icon: `${APP_ORIGIN}/assets/applications/pocetnik-icon-stupen-2.png`,
    stage: '2. stupeň',
  },
  {
    name: 'Slovní úlohy',
    body: 'Slovní úlohy po krocích: žák si úlohu rozebere, zapíše a vyřeší.',
    icon: `${APP_ORIGIN}/assets/applications/slovni-ulohy-icon.svg`,
    stage: '2. stupeň',
  },
  {
    name: 'Přijímací zkoušky',
    body: 'Úlohy z přijímaček CERMAT po tématech i celé testy nanečisto.',
    icon: `${APP_ORIGIN}/assets/applications/prijimacky-icon.svg`,
    stage: '9. ročník',
  },
  {
    name: 'Funkce a grafy',
    body: 'Grafy funkcí, které se mění podle toho, jak žák posouvá parametry. Ideální na tabuli.',
    icon: `${APP_ORIGIN}/assets/applications/graf-icon.svg`,
    stage: '2. stupeň',
  },
  {
    name: 'Rýsování',
    body: 'Konstrukce krok za krokem: pravítko, kružítko a úhloměr na tabuli i záznamy, jak se úloha rýsuje.',
    icon: `${APP_ICON_STORAGE}/application-icon-dc5ff97a-9285-4ec6-9ca3-1a5534ba2af6-1789647779730.svg`,
    stage: '2. stupeň',
  },
  {
    name: 'Rovinné útvary a tělesa',
    body: 'Tělesa, která žáci otáčejí, rozkládají do sítě a počítají jejich povrch a objem.',
    icon: `${APP_ICON_STORAGE}/application-icon-4f9ee394-f5f9-4e9c-aeb0-25770cc3307f-1787307334254.svg`,
    stage: '2. stupeň',
  },
  {
    name: 'Zlomky',
    body: 'Zlomky názorně: zobrazit, porovnat, rozšířit a procvičit v jednoduchých aktivitách.',
    icon: `${APP_ICON_STORAGE}/application-icon-f8ffe4b0-4095-4214-bbe8-f3ab8bb3271e-1787307343854.svg`,
    stage: '2. stupeň',
  },
  {
    name: 'Algebraické dlaždice',
    body: 'Výrazy a rovnice jako tvary, které žáci skládají a odebírají. Úpravy výrazů pochopí, ne nabiflují.',
    icon: `${APP_ICON_STORAGE}/application-icon-d1311fe1-94f2-4dae-95b8-141428239974-1787307354294.svg`,
    stage: '2. stupeň',
  },
  {
    name: 'Matematické minihry',
    body: 'Krátké hry k úlohám z pracovních sešitů pro nejmenší. Procvičování, které děti baví.',
    icon: `${APP_ICON_STORAGE}/application-icon-new-1781271135863.svg`,
    stage: '1. stupeň',
  },
];

/**
 * Záložky, které by opakovaly videa níž: „Rýsování“ = Aplikace Rýsování.
 * Pracovní sešity jsou v sekci balíčků.
 */
/** V datech záložek je překlep „Bousové“; opravujeme ho jen tady, data se mají opravit v adminu. */
const PILOT_TAB_OVERRIDES = {
  ...MATEMATIKA_2_TAB_OVERRIDES,
  'Bousové kapitoly a úlohy': { tabText: 'Bonusové kapitoly a úlohy' },
  'Bousové kapitoly a\u00a0úlohy': { tabText: 'Bonusové kapitoly a\u00a0úlohy' },
  // Nejdůležitější: interaktivní pracovní listy jako první záložka.
  'Interaktivní pracovní listy s řešením': { order: 0, contentImage: imgPracovniListy, contentImageFit: 'contain' },
};

const PILOT_EXCLUDED_TABS = [...MATH2_ECOSYSTEM_EXCLUDED_TABS, 'Aplikace Rýsování'];

/** Aplikace, které už mají své video v přehrávači výše — v seznamu se neopakují. */
const APPS_IN_VIDEOS = new Set([
  'Početník',
  'Slovní úlohy',
  'Přijímací zkoušky',
  'Rýsování',
]);

function InteractiveSection() {
  return (
    <section id="interaktivni" className="scroll-mt-24 bg-white px-4 py-14 sm:px-6 md:px-12 md:py-16">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle
          eyebrow="Co pilotujete"
          title="Interaktivní verzi naší matematiky"
          body="V pilotáži dostanete celou digitální matematiku Vividbooks: učebnici, pracovní listy, procvičování a všechny naše interaktivní aplikace. Pro všechny učitele i žáky vaší školy."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {USES.map((use, i) => (
            <article key={use.title} className="rounded-[22px] bg-[#f3eeff] p-6">
              <span className="text-[13px] font-bold text-[#7C3AED]" style={{ fontFamily: FF }}>
                0{i + 1}
              </span>
              <h3 className="mt-1 text-[22px] leading-tight text-[#001161]" style={HEADING}>
                {use.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#001161]/65 md:text-[15px]" style={{ fontFamily: FF }}>
                {formatTypography(use.body)}
              </p>
            </article>
          ))}
        </div>

        <h3 className="mt-14 text-[30px] leading-tight text-[#001161] md:text-[38px]" style={HEADING}>
          {formatTypography('Co všechno v aplikaci najdete')}
        </h3>
        <p className="mt-2 mb-6 max-w-[640px] text-[15px] leading-relaxed text-[#001161]/60" style={{ fontFamily: FF }}>
          {formatTypography('Učebnice, pracovní listy, procvičování a aplikace v jednom prostředí.')}
        </p>
        <div id="digital" className="scroll-mt-24 overflow-hidden rounded-[28px]">
          <SubjectTabsSection
            subject="Matematika 2. stupeň"
            displayName="Matematika"
            light
            hideSectionHeading
            excludeTabTexts={PILOT_EXCLUDED_TABS}
            tabOverrides={PILOT_TAB_OVERRIDES}
          />
        </div>

        <MathVoicedVideos
          secondStage
          sansTitle
          controls
          className="mt-14 !px-0"
          title="Jak to vypadá v hodině"
          body="Krátká videa se zvukem: co v pilotáži dostanete a jak s tím pracujete v hodině."
        />

        <p className="mt-8 text-[14px] font-bold text-[#001161]/45" style={{ fontFamily: FF }}>
          {formatTypography('A k tomu další aplikace k matematice')}
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MATH_APPS.filter((app) => !APPS_IN_VIDEOS.has(app.name)).map((app) => (
            <li key={app.name} className="flex gap-4 rounded-[20px] bg-[#f8f9fc] p-4 ring-1 ring-[#001161]/6">
              <img
                src={app.icon}
                alt=""
                loading="lazy"
                className="h-14 w-14 shrink-0 rounded-[14px] object-cover shadow-sm"
              />
              <div className="min-w-0" style={{ fontFamily: FF }}>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[16px] font-bold text-[#001161]">{app.name}</span>
                  <span className="text-[12px] font-bold text-[#001161]/40">{app.stage}</span>
                </p>
                <p className="mt-1 text-[13px] leading-snug text-[#001161]/62">{formatTypography(app.body)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-[14px] text-[#001161]/60" style={{ fontFamily: FF }}>
          Chcete vědět víc o naší matematice pro 2. stupeň?{' '}
          <Link to="/kampane/matematika-2-stupen" className="font-bold text-[#4B48CC] underline underline-offset-2">
            Podívejte se sem
          </Link>
        </p>
      </div>
    </section>
  );
}


function WorkbooksSection({ products }: { products: Product[] }) {
  const groups = useMemo(
    () =>
      SERIES.map((series) => {
        const books = products.filter(series.match).sort(sortWorkbooks);
        const sets = setsByGrade(books);
        const full = sets.reduce((sum, s) => sum + s.full, 0);
        const pilot = sets.reduce((sum, s) => sum + s.pilot, 0);
        return { series, books, sets, full, pilot };
      }).filter((g) => g.sets.length > 0),
    [products],
  );

  return (
    <section id="sesity" className="scroll-mt-24 bg-[#001161] px-4 py-14 sm:px-6 md:px-12 md:py-20">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle
          dark
          eyebrow="Pracovní sešity se slevou 20 %"
          title="Balíčky sešitů matematiky"
          body="Interaktivní matematiku můžete používat i k titulům, které už máte. Pokud chcete naše sešity, vyberte celou řadu nebo jen ročníky, které potřebujete. Vložte sadu do košíku, sleva už je v ceně."
        />

        {groups.length === 0 ? (
          <p className="text-center text-[14px] text-white/50" style={{ fontFamily: FF }}>
            Načítám sešity…
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((g) => (
              <SeriesBundle key={g.series.id} {...g} products={products} />
            ))}
          </div>
        )}

        <p className="mx-auto mt-6 max-w-[720px] text-center text-[13px] leading-relaxed text-white/55" style={{ fontFamily: FF }}>
          {formatTypography(
            'Ceny jsou za jednu sadu, včetně DPH. Ke sešitům pro žáky máte digitální přístup zdarma i po skončení pilotáže (od 15 kusů sešitů).',
          )}
        </p>
      </div>
    </section>
  );
}

/** Vějíř všech obálek řady — šířka se přizpůsobí počtu sešitů, nikdy nepřeteče. */
function SeriesFan({ books, products }: { books: Product[]; products: Product[] }) {
  const n = books.length;
  const mid = (n - 1) / 2;
  const coverW = 92;
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(320);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setBoxW(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Rezerva na naklonění krajních obálek, aby nic nepřeteklo přes okraj karty.
  const step = n > 1 ? Math.max(14, Math.min(52, (boxW - coverW - 28) / (n - 1))) : 0;
  return (
    <div ref={boxRef} className="relative mx-auto h-[170px] w-full max-w-[360px]">
      <div className="absolute bottom-0 left-1/2" style={{ width: coverW + step * (n - 1), transform: 'translateX(-50%)' }}>
        {books.map((book, i) => {
          const offset = i - mid;
          return (
            <Link
              key={String(book.id)}
              to={productDetailPath(book, products)}
              title={book.name}
              className="absolute bottom-0 block origin-bottom transition hover:z-50 hover:-translate-y-2"
              style={{
                left: i * step,
                zIndex: 10 + i,
                transform: `rotate(${offset * (n > 6 ? 3 : 5)}deg) translateY(${Math.abs(offset) * 3}px)`,
              }}
            >
              <ImageWithFallback
                src={getProductImage(book)}
                alt={book.name ?? ''}
                className="object-contain"
                style={{ width: coverW, height: 134, filter: 'drop-shadow(0 3px 8px rgba(0, 17, 97, 0.18))' }}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Balíčky pilotáže v eshopu (E-shop → Balíčky) se zlevněnou pevnou cenou. Sleva do košíku
 * jde jen přes ně, protože pokladna přepočítává ceny podle ceníku a balíčků.
 * Celá řada: `pilotaz-mat-<řada>`, jeden ročník: `pilotaz-mat-<řada>-<ročník>`.
 * Dokud balíček v eshopu není, tlačítko Do košíku se nezobrazí.
 */
export function pilotBundleId(seriesId: string, grade?: number) {
  return grade ? `pilotaz-mat-${seriesId}-${grade}` : `pilotaz-mat-${seriesId}`;
}

function usePilotBundle(id: string): ProductBundleRecord | null {
  const { productBundles } = useProducts();
  return useMemo(() => {
    const b = productBundles.find((x) => String(x.id) === id);
    return b && isProductBundleActiveAt(b) ? b : null;
  }, [productBundles, id]);
}

function AddBundleButton({
  bundleId,
  products,
  compact = false,
}: {
  bundleId: string;
  products: Product[];
  compact?: boolean;
}) {
  const bundle = usePilotBundle(bundleId);
  const { addItem, openCart } = useCart();
  const [added, setAdded] = useState(false);
  if (!bundle) return null;

  const add = () => {
    const lines = buildBundleCartLines(products, bundle, `pilotaz-${bundle.id}`);
    if (lines.length === 0) return;
    for (const line of lines) addItem({ ...line, quantity: 1 });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
    openCart();
  };

  return (
    <button
      type="button"
      onClick={add}
      aria-label={`Do košíku: ${bundle.title}`}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-bold text-white transition hover:scale-[1.03] ${
        added ? 'bg-green-600' : 'bg-[#001161] hover:bg-[#001161]/85'
      } ${compact ? 'h-10 w-10' : 'px-5 py-3 text-[15px]'}`}
      style={{ fontFamily: FF }}
    >
      {added ? <CheckCircle2 className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
      {compact ? null : added ? 'Přidáno' : 'Do košíku'}
    </button>
  );
}

function SeriesBundle({
  series,
  books,
  sets,
  full,
  pilot,
  products,
}: {
  series: Series;
  books: Product[];
  sets: ReturnType<typeof setsByGrade>;
  full: number;
  pilot: number;
  products: Product[];
}) {
  const grades = sets.map((s) => s.grade);
  const gradeRange = grades.length > 1 ? `${grades[0]}.–${grades[grades.length - 1]}. ročník` : `${grades[0]}. ročník`;
  const seriesBundle = usePilotBundle(pilotBundleId(series.id));
  return (
    <article className={`overflow-hidden rounded-[26px] border ${series.tone.card} ${series.tone.border}`}>
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* celá řada */}
        <div className="flex flex-col p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white ${series.tone.chip}`} style={{ fontFamily: FF }}>
              Celá řada
            </span>
            <span className="text-[13px] font-bold text-[#001161]/50" style={{ fontFamily: FF }}>
              {gradeRange} · {books.length} sešitů
            </span>
          </div>
          <h3 className="mt-3 text-[28px] leading-tight text-[#001161] md:text-[32px]" style={HEADING}>
            {series.title}
          </h3>
          <p className="mt-1 text-[14px] leading-snug text-[#001161]/60" style={{ fontFamily: FF }}>
            {formatTypography(series.subtitle)}
          </p>
          <div className="mt-6">
            <SeriesFan books={books} products={products} />
          </div>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1" style={{ fontFamily: FF }}>
            <span className="text-[34px] font-bold leading-none text-[#001161]">{formatKc(pilot)}</span>
            <span className="text-[16px] text-[#001161]/40 line-through">{formatKc(full)}</span>
            <span className="rounded-md bg-white px-2 py-0.5 text-[13px] font-bold text-[#7C3AED]">ušetříte {formatKc(full - pilot)}</span>
          </div>
          <p className="mt-1 text-[13px] text-[#001161]/50" style={{ fontFamily: FF }}>
            sada všech {books.length} sešitů řady
          </p>
          {seriesBundle ? (
            <div className="mt-5">
              <AddBundleButton bundleId={pilotBundleId(series.id)} products={products} />
            </div>
          ) : null}
        </div>

        {/* po ročnících */}
        <div className="border-t border-[#001161]/8 bg-white/70 p-6 md:border-l md:border-t-0 md:p-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/40" style={{ fontFamily: FF }}>
              Nebo jen jeden ročník
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-[#001161]/8">
            {sets.map((set) => (
              <li key={set.grade} className="flex items-center gap-4 py-3">
                <div className="flex shrink-0 -space-x-5">
                  {set.items.map((book, i) => (
                    <ImageWithFallback
                      key={String(book.id)}
                      src={getProductImage(book)}
                      alt={book.name ?? ''}
                      className="object-contain"
                      style={{
                        width: 34,
                        height: 48,
                        position: 'relative',
                        zIndex: 10 + i,
                        filter: 'drop-shadow(0 1px 3px rgba(0, 17, 97, 0.18))',
                      }}
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1" style={{ fontFamily: FF }}>
                  <p className="text-[15px] font-bold text-[#001161]">{set.grade}. ročník</p>
                  <p className="text-[12px] leading-snug text-[#001161]/50">{set.items.map(shortTitle).join(' · ')}</p>
                </div>
                <div className="shrink-0 text-right" style={{ fontFamily: FF }}>
                  <p className="text-[17px] font-bold leading-none text-[#001161]">{formatKc(set.pilot)}</p>
                  <p className="mt-1 text-[12px] text-[#001161]/40 line-through">{formatKc(set.full)}</p>
                </div>
                <AddBundleButton bundleId={pilotBundleId(series.id, set.grade)} products={products} compact />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────── metodika a webináře ─────────────────────────── */

function MethodologySection() {
  return (
    <section id="metodika" className="scroll-mt-24 bg-[#f5f7fd] px-4 py-14 sm:px-6 md:px-12 md:py-16">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle
          eyebrow="Metodika a webináře"
          title="Nebudete na to sami"
          body="Ke každému velkému tématu máme webinář „Jak na…“ a krátká metodická videa. Pustíte si je, kdy se vám to hodí, a k webinářům DVPP dostanete certifikát."
        />
        <YouTubePlaylistSlider
          videos={MATH_CAMPAIGN_WEBINAR_VIDEOS}
          openAsRecordingPage
          eyebrow="Záznamy webinářů"
          heading="Jak učit klíčová témata matematiky"
          subheading="Hodinové webináře k procentům, jednotkám, úměrnosti, geometrii, zlomkům, algebraickým výrazům i novým tématům RVP. Pusťte si je, kdy se vám to hodí."
        />
        <YouTubePlaylistSlider
          className="mt-8"
          videos={MATH_METHODOLOGY_PLAYLIST_VIDEOS}
          playlistUrl={MATH_METHODOLOGY_PLAYLIST_URL}
          eyebrow="Videometodika"
          heading="Jak s materiály opravdu učit"
          subheading="Ukázky výuky a metodické komentáře Františka Cába k jednotlivým kapitolám."
        />
      </div>
    </section>
  );
}

/* ─────────────────────────── přihláška ─────────────────────────── */

type SchoolResult = { name: string; ico: string; address?: string };

function SchoolField({
  schoolName,
  ico,
  onChange,
}: {
  schoolName: string;
  ico: string;
  onChange: (name: string, ico: string) => void;
}) {
  const [results, setResults] = useState<SchoolResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const search = (q: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`${SERVER}/school-search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        const data = (await res.json()) as { results?: SchoolResult[] };
        const list = (data.results ?? []).slice(0, 8);
        setResults(list);
        setOpen(list.length > 0);
      } catch {
        setResults([]);
      }
    }, 350);
  };

  return (
    <div ref={boxRef} className="relative grid gap-3 sm:grid-cols-[1fr_150px]">
      <div className="relative">
        <input
          className={INPUT}
          placeholder="Název školy *"
          value={schoolName}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value, ico);
            search(e.target.value);
          }}
          onFocus={() => setOpen(results.length > 0)}
        />
        {open ? (
          <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[280px] overflow-auto rounded-[14px] border border-[#001161]/10 bg-white py-1 shadow-lg">
            {results.map((s) => (
              <li key={`${s.ico}-${s.name}`}>
                <button
                  type="button"
                  className="block w-full px-4 py-2.5 text-left text-[14px] text-[#001161] hover:bg-[#f5f7fd]"
                  style={{ fontFamily: FF }}
                  onClick={() => {
                    onChange(s.name, s.ico);
                    setOpen(false);
                  }}
                >
                  <span className="font-bold">{s.name}</span>
                  <span className="ml-2 text-[12px] text-[#001161]/45">
                    IČO {s.ico}
                    {s.address ? ` · ${s.address}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <input
        className={INPUT}
        placeholder="IČO *"
        inputMode="numeric"
        value={ico}
        onChange={(e) => onChange(schoolName, e.target.value.replace(/\D/g, '').slice(0, 10))}
      />
    </div>
  );
}

const INPUT =
  'w-full rounded-[14px] border border-[#001161]/15 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none transition placeholder:text-[#001161]/40 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15';

type Outcome =
  | { kind: 'codes'; teacherCode: string; studentCode: string }
  | { kind: 'manual'; message: string }
  | { kind: 'tip' };

type TrialResponse = { ok?: boolean; status?: string; code?: string; message?: string; teacherCode?: string; studentCode?: string };

/** Odpověď Kabinetu na přihlášku → co ukážeme učiteli. `hasSchool` = škola už Vividbooks má (cesta „Ano“). */
function outcomeFromTrial(data: TrialResponse, hasSchool: boolean): Outcome {
  if (data.ok && (data.status === 'created' || data.status === 'extended') && data.teacherCode && data.studentCode) {
    return { kind: 'codes', teacherCode: data.teacherCode, studentCode: data.studentCode };
  }
  if (data.ok && (data.status === 'created' || data.status === 'extended')) {
    return { kind: 'manual', message: 'Přístupové kódy vám pošleme e-mailem.' };
  }
  // Kabinet žádost zapsal s poznámkou pilotáže; škola už přístup má nebo ho nedávno měla.
  if (data.code === 'HAS_ACTIVE_SUBSCRIPTION') {
    return {
      kind: 'manual',
      message: hasSchool
        ? 'Matematiku a Přijímací zkoušky vám k přístupu připojíme do dvou pracovních dnů. Kódy školy zůstávají stejné.'
        : 'Vaše škola už u nás předplatné má. Ozveme se vám a pilotáž matematiky k němu připojíme.',
    };
  }
  if (data.code === 'HAS_ACTIVE_TRIAL') {
    return {
      kind: 'manual',
      message: hasSchool
        ? 'Váš zkušební přístup prodloužíme do konce školního roku do dvou pracovních dnů. Kódy školy zůstávají stejné.'
        : 'Vaše škola už zkušební přístup má. Ozveme se vám a prodloužíme ho do konce školního roku.',
    };
  }
  return { kind: 'manual', message: 'Vaše škola u nás nedávno zkoušela přístup. Ozveme se vám a pilotáž vám nastavíme ručně.' };
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-3 text-[14px] text-[#001161]/55 hover:text-[#001161]" style={{ fontFamily: FF }}>
      ← Zpět
    </button>
  );
}

function StagePicker({ stages, onToggle }: { stages: number[]; onToggle: (n: number) => void }) {
  return (
    <fieldset className="mt-1">
      <legend className="mb-2 text-[14px] font-bold text-[#001161]" style={{ fontFamily: FF }}>
        Matematiku chcete pilotovat na
      </legend>
      <div className="flex flex-wrap gap-2">
        {[1, 2].map((n) => {
          const on = stages.includes(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onToggle(n)}
              aria-pressed={on}
              className={`rounded-xl border px-4 py-2.5 text-[14px] font-bold transition ${
                on ? 'border-[#7C3AED] bg-[#f3eeff] text-[#5B21B6]' : 'border-[#001161]/15 bg-white text-[#001161]/60'
              }`}
              style={{ fontFamily: FF }}
            >
              {n}. stupni
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SubmitButton({ submitting, children }: { submitting: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-4 text-[16px] font-bold text-white transition hover:bg-[#6D28D9] disabled:opacity-60"
      style={{ fontFamily: FF }}
    >
      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
      {children}
    </button>
  );
}

function ErrorBox({ error }: { error: string }) {
  return error ? (
    <p className="rounded-[12px] bg-red-50 px-4 py-3 text-[14px] text-red-700" style={{ fontFamily: FF }}>
      {error}
    </p>
  ) : null;
}

function PilotForm() {
  const [path, setPath] = useState<null | 'yes' | 'no' | 'tip'>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', position: '', pupils: '' });
  const [schoolName, setSchoolName] = useState('');
  const [ico, setIco] = useState('');
  const [stages, setStages] = useState<number[]>([1, 2]);
  const [wantsWorkbooks, setWantsWorkbooks] = useState(false);
  const [gdpr, setGdpr] = useState(false);
  const [colleagues, setColleagues] = useState<string[]>([]);
  const [message, setMessage] = useState(DEFAULT_INVITE_MESSAGE);
  const [lookup, setLookup] = useState<SchoolLookup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [invites, setInvites] = useState<InviteResult[]>([]);
  const [inviteError, setInviteError] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleStage = (n: number) => setStages((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n].sort()));
  const go = (next: typeof path) => {
    setPath(next);
    setError('');
    if (next !== 'yes') setLookup(null);
  };

  const note = () =>
    [
      PILOT_NOTE,
      `stupně: ${stages.join(' a ')}.`,
      wantsWorkbooks ? `chce sešity se slevou${form.pupils.trim() ? `, cca ${form.pupils.trim()} žáků` : ''}` : 'sešity zatím ne',
      colleagues.length ? `pozval kolegy: ${colleagues.length}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

  const inviteColleagues = async (mode: 'invite' | 'tip') => {
    if (!colleagues.length) return;
    const r = await sendInvites({ mode, inviterEmail: form.email.trim(), inviterName: form.name.trim(), emails: colleagues, message });
    setInvites(r.results);
    setInviteError(r.error || '');
  };

  const requestTrial = async (body: Record<string, unknown>): Promise<TrialResponse> => {
    const res = await fetch(`${KABINET_TRIAL_FN}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as TrialResponse | null;
    if (!data) throw new Error(`Server neodpověděl (HTTP ${res.status}).`);
    if (data.code === 'INVALID') throw new Error(data.message || 'Vyplňte prosím všechny povinné údaje.');
    if (!(data.ok && (data.status === 'created' || data.status === 'extended')) && data.status !== 'rejected') {
      throw new Error(data.message || `Přihlášku se nepodařilo odeslat (HTTP ${res.status}).`);
    }
    return data;
  };

  const failed = (err: unknown) =>
    setError(
      `${err instanceof Error ? err.message : 'Přihlášku se nepodařilo odeslat.'} Zkuste to prosím znovu, nebo napište na hello@vividbooks.com.`,
    );

  /* Ano, škola Vividbooks má: 1) e-mail → najdeme školu */
  const findSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmailFormat(form.email.trim())) return setError(EMAIL_FORMAT_HINT_CS);
    setSubmitting(true);
    setError('');
    try {
      setLookup(await lookupSchool(form.email.trim()));
    } catch (err) {
      failed(err);
    } finally {
      setSubmitting(false);
    }
  };

  /* Ano: 2) odemknout matematiku a pozvat kolegy */
  const attach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Vyplňte prosím jméno a příjmení.');
    if (stages.length === 0) return setError('Vyberte prosím alespoň jeden stupeň.');
    if (!gdpr) return setError('Potřebujeme váš souhlas se zpracováním osobních údajů.');
    setSubmitting(true);
    setError('');
    try {
      const data = await requestTrial({
        fullName: form.name.trim(),
        email: form.email.trim(),
        schoolName: lookup?.schoolName || '',
        subjects: stages.map((n) => `Mathematics-${n}`),
        schoolStages: stages,
        newsletter: false,
        country: 'cz',
        note: note(),
      });
      await inviteColleagues('invite');
      setOutcome(outcomeFromTrial(data, true));
    } catch (err) {
      failed(err);
    } finally {
      setSubmitting(false);
    }
  };

  /* Ne, zatím nemáme: přihláška školy (+ pozvat kolegy) */
  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Vyplňte prosím jméno a příjmení.');
    if (!schoolName.trim() || ico.length < 6) return setError('Vyberte prosím školu a doplňte IČO.');
    if (!isValidEmailFormat(form.email.trim())) return setError(EMAIL_FORMAT_HINT_CS);
    if (!form.phone.trim()) return setError('Vyplňte prosím telefon.');
    if (!form.position) return setError('Vyberte prosím svou pozici.');
    if (stages.length === 0) return setError('Vyberte prosím alespoň jeden stupeň.');
    if (!gdpr) return setError('Potřebujeme váš souhlas se zpracováním osobních údajů.');
    setSubmitting(true);
    setError('');
    try {
      const data = await requestTrial({
        fullName: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        position: form.position,
        schoolName: schoolName.trim(),
        ico,
        subjects: stages.map((n) => `Mathematics-${n}`),
        schoolStages: stages,
        newsletter: false,
        country: 'cz',
        note: note(),
      });
      await inviteColleagues('invite');
      setOutcome(outcomeFromTrial(data, false));
    } catch (err) {
      failed(err);
    } finally {
      setSubmitting(false);
    }
  };

  /* Tip kolegovi nebo vedení (bez přihlášky) */
  const sendTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Vyplňte prosím své jméno.');
    if (!isValidEmailFormat(form.email.trim())) return setError(EMAIL_FORMAT_HINT_CS);
    if (!colleagues.length) return setError('Zadejte alespoň jeden e-mail.');
    setSubmitting(true);
    setError('');
    try {
      const r = await sendInvites({ mode: 'tip', inviterEmail: form.email.trim(), inviterName: form.name.trim(), emails: colleagues, message });
      if (r.error) throw new Error(r.error);
      setInvites(r.results);
      setOutcome({ kind: 'tip' });
    } catch (err) {
      failed(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (outcome) {
    const anySent = invites.some((r) => r.status === 'sent');
    return (
      <div className="rounded-[24px] border border-green-200 bg-[#F0FDF4] p-7 text-center md:p-9">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
        <h3 className="text-[26px] text-[#001161]" style={HEADING}>
          {outcome.kind === 'tip' ? 'Tip jsme poslali' : 'Vítejte v pilotáži!'}
        </h3>
        {outcome.kind === 'codes' ? (
          <>
            <p className="mx-auto mt-2 max-w-[440px] text-[15px] leading-relaxed text-[#001161]/70" style={{ fontFamily: FF }}>
              {formatTypography(
                'Matematiku máte odemčenou hned. Do dvou pracovních dnů vám přístup prodloužíme do konce školního roku a ozveme se kvůli sešitům.',
              )}
            </p>
            <div className="mx-auto mt-6 grid max-w-md grid-cols-1 gap-3 text-left sm:grid-cols-2">
              {[
                ['Kód pro učitele', outcome.teacherCode],
                ['Kód pro žáky', outcome.studentCode],
              ].map(([label, code]) => (
                <div key={label} className="rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 shadow-sm">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#001161]/45" style={{ fontFamily: FF }}>
                    {label}
                  </p>
                  <p className="break-all font-mono text-[18px] font-bold tracking-wide text-[#001161]">{code}</p>
                </div>
              ))}
            </div>
          </>
        ) : outcome.kind === 'tip' ? (
          <p className="mx-auto mt-2 max-w-[440px] text-[15px] leading-relaxed text-[#001161]/70" style={{ fontFamily: FF }}>
            {formatTypography('Dostanou odkaz na tuhle přihlášku. Kopii se seznamem adres jsme poslali i vám.')}
          </p>
        ) : (
          <p className="mx-auto mt-2 max-w-[440px] text-[15px] leading-relaxed text-[#001161]/70" style={{ fontFamily: FF }}>
            {formatTypography(`Přihlášku máme. ${outcome.message}`)}
          </p>
        )}
        {outcome.kind !== 'tip' && anySent ? (
          <p className="mx-auto mt-5 max-w-[440px] text-[14px] text-[#001161]/70" style={{ fontFamily: FF }}>
            {formatTypography('Kolegům jsme poslali pozvánku vaším jménem. Kopii se seznamem adres máte v e-mailu.')}
          </p>
        ) : null}
        <InviteResultList results={invites} tip={outcome.kind === 'tip'} />
        {inviteError ? (
          <p className="mx-auto mt-4 max-w-[440px] text-[13px] text-amber-700" style={{ fontFamily: FF }}>
            {formatTypography(`Pozvánky kolegům: ${inviteError}`)}
          </p>
        ) : null}
        {outcome.kind === 'codes' ? (
          <Link
            to="/otevrit"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#001161] px-6 py-3 text-[15px] font-bold text-white transition hover:bg-[#001161]/85"
            style={{ fontFamily: FF }}
          >
            Otevřít aplikaci
          </Link>
        ) : null}
      </div>
    );
  }

  const card = 'rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-[#001161]/8 md:p-8';
  const workbooksBox = (
    <>
      <label className="mt-1 flex cursor-pointer items-start gap-3 rounded-[14px] bg-[#f8f9fc] p-4" style={{ fontFamily: FF }}>
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[#7C3AED]" checked={wantsWorkbooks} onChange={(e) => setWantsWorkbooks(e.target.checked)} />
        <span className="text-[14px] leading-snug text-[#001161]">
          <strong>Mám zájem i o pracovní sešity se slevou 20 %</strong>
          <span className="block text-[13px] text-[#001161]/55">Připravíme vám nabídku podle počtu žáků.</span>
        </span>
      </label>
      {wantsWorkbooks ? (
        <input className={INPUT} placeholder="Přibližný počet žáků (nepovinné)" inputMode="numeric" value={form.pupils} onChange={set('pupils')} />
      ) : null}
    </>
  );
  const consent = (
    <label className="mt-1 flex cursor-pointer items-start gap-3" style={{ fontFamily: FF }}>
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[#7C3AED]" checked={gdpr} onChange={(e) => setGdpr(e.target.checked)} />
      <span className="text-[13px] leading-snug text-[#001161]/65">
        Souhlasím se{' '}
        <a href="/kontakt" target="_blank" rel="noreferrer" className="underline">
          zpracováním osobních údajů
        </a>{' '}
        pro účely pilotáže. *
      </span>
    </label>
  );
  const inviteFields = (
    <div className="mt-1 grid gap-3 border-t border-[#001161]/8 pt-4">
      <ColleaguesField label="Pozvěte kolegy" optional emails={colleagues} onChange={setColleagues} />
      {colleagues.length ? <MessageField value={message} onChange={setMessage} /> : null}
    </div>
  );

  if (!path) {
    const options: { key: 'yes' | 'no'; title: string; text: string; icon: string; tone: string }[] = [
      {
        key: 'yes',
        title: 'Ano, naše škola Vividbooks má',
        text: 'Připojíme vám matematiku a Přijímací zkoušky do konce školního roku a pozvete kolegy.',
        icon: '✓',
        tone: 'bg-[#ecfdf5] text-[#059669]',
      },
      {
        key: 'no',
        title: 'Ne, zatím nemáme',
        text: 'Vyplníte krátkou přihlášku, matematiku máte odemčenou hned a kolegy pozvete rovnou.',
        icon: '+',
        tone: 'bg-[#f3eeff] text-[#7C3AED]',
      },
    ];
    return (
      <div className={card}>
        <p className="mb-4 text-[20px] text-[#001161]" style={HEADING}>
          Má vaše škola Vividbooks?
        </p>
        <div className="grid gap-3">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => go(o.key)}
              className="flex items-start gap-4 rounded-[18px] border-[1.5px] border-[#001161]/15 bg-white p-4 text-left transition hover:border-[#7C3AED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C3AED]/50"
              style={{ fontFamily: FF }}
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[20px] font-bold ${o.tone}`}>{o.icon}</span>
              <span>
                <strong className="block text-[17px] text-[#001161]">{o.title}</strong>
                <span className="text-[14px] text-[#001161]/60">{formatTypography(o.text)}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-[13px] text-[#001161]/55" style={{ fontFamily: FF }}>
          Nevíte? Vyberte „Ano“. Podle vašeho e-mailu to poznáme.
        </p>
      </div>
    );
  }

  if (path === 'yes' && !lookup?.found) {
    return (
      <form onSubmit={findSchool} noValidate className={card}>
        <BackLink onClick={() => go(null)} />
        <div className="grid gap-3">
          <label htmlFor="pilot-email" className="text-[14px] font-bold text-[#001161]" style={{ fontFamily: FF }}>
            Váš školní e-mail
          </label>
          <input id="pilot-email" className={INPUT} type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="jmeno@skola.cz" />
          <p className="-mt-1 text-[12px] text-[#001161]/50" style={{ fontFamily: FF }}>
            Podle něj najdeme vaši školu. Ten, se kterým se do Vividbooks přihlašujete.
          </p>
          {lookup && !lookup.found ? (
            <div className="rounded-[14px] border border-amber-200 bg-[#fff7ed] p-4 text-[14px] leading-relaxed text-[#001161]/80" style={{ fontFamily: FF }}>
              <strong className="block text-[#001161]">Tenhle e-mail u nás nemáme.</strong>
              Zkontrolujte, jestli je to adresa, se kterou se do Vividbooks přihlašujete. Jestli vaše škola Vividbooks nemá, vyplňte krátkou
              přihlášku.
              <button type="button" onClick={() => go('no')} className="mt-2 block font-bold text-[#7C3AED] hover:underline">
                Vyplnit přihlášku školy →
              </button>
            </div>
          ) : null}
          <ErrorBox error={error} />
          <SubmitButton submitting={submitting}>Pokračovat</SubmitButton>
        </div>
      </form>
    );
  }

  if (path === 'yes' && lookup?.found) {
    const has = lookup.subjects?.length ? `Máte u nás ${lookup.subjects.join(', ')}. ` : '';
    return (
      <form onSubmit={attach} noValidate className={card}>
        <BackLink onClick={() => setLookup(null)} />
        <div className="grid gap-3">
          <div className="flex items-center gap-3 rounded-[16px] border border-green-200 bg-[#ecfdf5] p-4" style={{ fontFamily: FF }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#059669] text-[14px] font-bold text-white">ZŠ</span>
            <span className="text-[14px] leading-snug text-[#001161]/80">
              <strong className="block text-[16px] text-[#001161]">{lookup.schoolName}</strong>
              {formatTypography(`${has}Matematiku a Přijímací zkoušky k tomu připojíme do konce školního roku, pro všechny učitele i žáky.`)}
            </span>
          </div>
          <input className={INPUT} placeholder="Jméno a příjmení *" value={form.name} onChange={set('name')} autoComplete="name" />
          <StagePicker stages={stages} onToggle={toggleStage} />
          {inviteFields}
          {workbooksBox}
          {consent}
          <ErrorBox error={error} />
          <SubmitButton submitting={submitting}>
            {colleagues.length ? `Odemknout matematiku a pozvat kolegy (${colleagues.length})` : 'Odemknout matematiku naší škole'}
          </SubmitButton>
          <p className="text-center text-[12px] text-[#001161]/45" style={{ fontFamily: FF }}>
            Kódy školy zůstávají stejné. Učitelé i žáci uvidí matematiku pod svým účtem.
          </p>
        </div>
      </form>
    );
  }

  if (path === 'tip') {
    return (
      <form onSubmit={sendTip} noValidate className={card}>
        <BackLink onClick={() => go('no')} />
        <div className="grid gap-3">
          <p className="text-[20px] text-[#001161]" style={HEADING}>
            Pošlete tip kolegovi nebo vedení
          </p>
          <p className="-mt-1 text-[14px] text-[#001161]/60" style={{ fontFamily: FF }}>
            Dostanou odkaz na tuhle přihlášku a školu přihlásí sami.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={INPUT} placeholder="Vaše jméno *" value={form.name} onChange={set('name')} autoComplete="name" />
            <input className={INPUT} placeholder="Váš e-mail *" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </div>
          <ColleaguesField label="Komu tip pošlete" emails={colleagues} onChange={setColleagues} hint="Nejvýš 15 adres. Dostanou tip vaším jménem." />
          <MessageField value={message} onChange={setMessage} />
          <ErrorBox error={error} />
          <SubmitButton submitting={submitting}>Poslat tip</SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={register} noValidate className={card}>
      <BackLink onClick={() => go(null)} />
      <div className="grid gap-3">
        <input className={INPUT} placeholder="Jméno a příjmení *" value={form.name} onChange={set('name')} autoComplete="name" />
        <SchoolField
          schoolName={schoolName}
          ico={ico}
          onChange={(name, nextIco) => {
            setSchoolName(name);
            setIco(nextIco);
          }}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={INPUT} placeholder="Školní e-mail *" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          <input className={INPUT} placeholder="Telefon *" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
        </div>
        <select className={`${INPUT} cursor-pointer`} value={form.position} onChange={set('position')}>
          <option value="" disabled>
            Vaše pozice *
          </option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <StagePicker stages={stages} onToggle={toggleStage} />
        {inviteFields}
        {workbooksBox}
        {consent}
        <ErrorBox error={error} />
        <SubmitButton submitting={submitting}>
          {colleagues.length ? `Přihlásit školu a pozvat kolegy (${colleagues.length})` : 'Přihlásit školu do pilotáže'}
        </SubmitButton>
        <p className="text-center text-[12px] text-[#001161]/45" style={{ fontFamily: FF }}>
          Přihlášky přijímáme do {DEADLINE_LABEL}.{' '}
          <button type="button" onClick={() => go('tip')} className="font-bold text-[#7C3AED] hover:underline">
            Nemůžete školu přihlásit sami? Pošlete tip kolegovi nebo vedení.
          </button>
        </p>
      </div>
    </form>
  );
}

/* ─────────────────────────── citace učitelů ─────────────────────────── */

/**
 * Citace z dotazníků po matematických webinářích (výběr Vítek 16. 10. 2026),
 * jen křestní jméno a stupeň, text krácený na hranici věty.
 */
const TESTIMONIALS = [
  {
    quote:
      'Místo toho, aby se děti učily mechanicky počítat, jsou vedeny k tomu, aby na principy přišly samy. Je skvělé, že tímto způsobem mohou dojít k tomu, že budou vědět, co to zlomek nebo desetinné číslo znamená v praxi.',
    name: 'Veronika',
    role: 'učitelka matematiky, 2. stupeň',
  },
  {
    quote:
      'Opět mě nadchlo zpracování daného tématu. Líbí se mi barevné provedení, které děti upoutá, a téma zpracované logicky s citem pro důkladné pochopení.',
    name: 'Michaela',
    role: 'učitelka matematiky, 2. stupeň',
  },
  {
    quote: 'Co je super, je ten Početník, co žáka po dvou příkladech posune na větší obtížnost, a když neumí, zase spadne.',
    name: 'Valerie',
    role: 'učitelka matematiky, 2. stupeň',
  },
  {
    quote:
      'Webinář byl pro mě utvrzením v tom, že jsem se s Vividbooks vydala správnou cestou. Moc se těším na nové objevování, první úspěchy a AHA momenty.',
    name: 'Vendula',
    role: 'učitelka, 1. stupeň',
  },
  {
    quote:
      'Vidím to jako mix klasické matematiky a matematiky prof. Hejného a tato kombinace se mi zdá optimální. Děti potřebují velké množství názornosti, aby pochopily smysl, a teprve potom navazuje procvičování.',
    name: 'Martina',
    role: 'začínající učitelka, 1. stupeň',
  },
];

function TestimonialsSection() {
  return (
    <section id="ucitele" className="scroll-mt-24 bg-white px-4 py-14 sm:px-6 md:px-12 md:py-16">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle eyebrow="Z dotazníků po webinářích" title="Co říkají učitelé" />
        <div className="columns-1 gap-4 md:columns-2 lg:columns-3 [&>figure]:mb-4">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="break-inside-avoid rounded-[22px] bg-[#f3eeff] p-6">
              <span className="block text-[44px] leading-[0.6] text-[#7C3AED]" style={{ fontFamily: COOPER }} aria-hidden>
                „
              </span>
              <blockquote className="mt-3 text-[16px] leading-relaxed text-[#001161]" style={{ fontFamily: FF }}>
                {formatTypography(t.quote)}
              </blockquote>
              <figcaption className="mt-4 text-[14px]" style={{ fontFamily: FF }}>
                <span className="font-bold text-[#001161]">{t.name}</span>
                <span className="text-[#001161]/55"> · {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function FormSection() {
  return (
    <section id="prihlaska" className="scroll-mt-24 bg-[#EDE4F7] px-4 py-14 sm:px-6 md:px-12 md:py-16">
      <div className="mx-auto grid max-w-[1100px] items-start gap-8 md:grid-cols-[1fr_1.15fr] md:gap-12">
        <div className="md:sticky md:top-24">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/45" style={{ fontFamily: FF }}>
            Přihláška do pilotáže
          </p>
          <h2 className="text-[30px] leading-[1.08] text-[#001161] md:text-[40px]" style={HEADING}>
            {formatTypography('Zkuste to s námi do konce školního roku')}
          </h2>
          <ul className="mt-6 flex flex-col gap-3" style={{ fontFamily: FF }}>
            {[
              'Přístup pro všechny učitele a žáky vaší školy',
              'Matematika pro 1. i 2. stupeň',
              '20 % sleva na pracovní sešity matematiky',
              'Žádné poplatky ani automatické prodloužení',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] text-[#001161]/75">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#7C3AED]" />
                {formatTypography(item)}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[14px] leading-relaxed text-[#001161]/60" style={{ fontFamily: FF }}>
            Raději se nejdřív poradíte? Zavolejte nám na{' '}
            <a href="tel:+420602227674" className="font-bold text-[#001161] hover:underline">
              +420 602 227 674
            </a>{' '}
            nebo napište na{' '}
            <a href="mailto:hello@vividbooks.com?subject=Pilot%C3%A1%C5%BE%20matematiky" className="font-bold text-[#001161] hover:underline">
              hello@vividbooks.com
            </a>
            .
          </p>
        </div>
        <PilotForm />
      </div>
    </section>
  );
}

const FAQ = [
  {
    question: 'Pro koho je pilotáž určená?',
    answer:
      'Pro základní školy, které matematiku od Vividbooks zatím naplno nepoužívají. Přihlásit se může učitel, ředitel i zástupce, přístup pak dostane celá škola.',
  },
  {
    question: 'Co se stane na konci školního roku?',
    answer:
      'Pilotáž končí s koncem školního roku 2026/27. Nic se neprodlužuje automaticky: přístup skončí a nic se vám nenaúčtuje. Pokud budete chtít pokračovat, domluvíme se. Ke sešitům pro žáky máte digitální přístup zdarma i dál.',
  },
  {
    question: 'Musíme si objednat pracovní sešity?',
    answer:
      'Ne. Interaktivní matematiku můžete používat k učebnicím a sešitům, které už ve škole máte, a až do konce školního roku je zdarma. Když budete chtít učit i s našimi pracovními sešity, objednáte si je se slevou 20 %.',
  },
  {
    question: 'Naše škola už u vás má jiný předmět nebo zkušební přístup.',
    answer:
      'Přihlaste se stejně. Ozveme se vám a pilotáž matematiky k vašemu přístupu připojíme.',
  },
  {
    question: 'Do kdy se můžeme přihlásit?',
    answer: `Přihlášky přijímáme do ${DEADLINE_LABEL}. Přístup otevřeme hned po přihlášení a platí do konce školního roku 2026/27, ať se přihlásíte v říjnu, nebo v prosinci.`,
  },
];

function FaqSection() {
  return (
    <section className="bg-white px-4 py-14 sm:px-6 md:px-12 md:py-16">
      <div className="mx-auto max-w-[820px]">
        <SectionTitle eyebrow="Časté otázky" title="Co vás nejspíš zajímá" />
        <div className="flex flex-col gap-3">
          {FAQ.map((item) => (
            <details key={item.question} className="group rounded-[18px] bg-[#f8f9fc] px-5 py-4 ring-1 ring-[#001161]/6">
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold text-[#001161]"
                style={{ fontFamily: FF }}
              >
                {formatTypography(item.question)}
                <span className="text-[22px] leading-none text-[#7C3AED] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-[#001161]/65" style={{ fontFamily: FF }}>
                {formatTypography(item.answer)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── stránka ─────────────────────────── */

export function MathPilotLandingPage() {
  const { products } = useProducts();
  const [scrolled, setScrolled] = useState(false);
  const mathWorkbooks = useMemo(() => (products as Product[]).filter(isMathWorkbook), [products]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 380);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#001161]" style={{ fontFamily: FF }}>
      <SEOHead
        title="Máme nejlepší matematiku, a chceme vám to názorně ukázat"
        path={PAGE_PATH}
        description="Vyzkoušejte matematiku Vividbooks pro 1. i 2. stupeň zdarma do konce školního roku 2026/27. K tomu pracovní sešity matematiky se slevou 20 %. Přihlášky do 31. 12. 2026."
        jsonLd={faqJsonLd(FAQ)}
      />

      <header
        className="sticky top-0 z-[60] backdrop-blur-sm transition-colors duration-300"
        style={{ backgroundColor: scrolled ? 'rgba(255,255,255,0.94)' : '#EDE4F7' }}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 md:px-10">
          <VividLogo />
          <nav className="hidden items-center gap-5 md:flex" aria-label="Navigace pilotáže">
            {[
              ['#interaktivni', 'Interaktivní verze'],
              ['#sesity', 'Sešity se slevou'],
              ['#metodika', 'Metodika a webináře'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-[14px] font-bold text-[#001161]/58 transition hover:text-[#001161]">
                {label}
              </a>
            ))}
          </nav>
          {scrolled ? <PrimaryButton href="#prihlaska" small>Přihlásit se</PrimaryButton> : <span className="w-[1px]" />}
        </div>
      </header>

      <main>
        <section className="overflow-hidden bg-[#EDE4F7] px-4 pb-0 pt-8 sm:px-6 md:px-10 md:pt-12">
          <div className="mx-auto max-w-[1040px] text-center">
            <p
              className="mx-auto mb-5 inline-flex flex-wrap justify-center gap-x-1 rounded-full bg-white/70 px-4 py-1.5 text-[13px] font-bold text-[#5B21B6]"
              style={{ fontFamily: FF }}
            >
              <span>Pilotáž matematiky ·</span>
              <span className="whitespace-nowrap">přihlášky do {DEADLINE_LABEL}</span>
            </p>
            <h1 className="text-[34px] leading-[1.06] tracking-tight text-[#001161] sm:text-[44px] md:text-[48px] lg:text-[54px]" style={{ fontFamily: COOPER }}>
              <span className="block">{formatTypography('Máme nejlepší matematiku,')}</span>
              <span className="block md:whitespace-nowrap">{formatTypography('a chceme vám to názorně\u00a0ukázat.')}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-[16px] leading-relaxed text-[#001161]/70 md:text-[18px]" style={{ fontFamily: FF }}>
              {formatTypography(
                'Proto vám interaktivní verzi dáváme zdarma až do konce školního roku. Tiskněte z ní, promítejte ji na tabuli a používejte ji k učebnicím, které už máte, nebo k našim sešitům se slevou 20 %.',
              )}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <PrimaryButton href="#prihlaska">Získat matematiku zdarma do konce školního roku</PrimaryButton>
              <a
                href="#sesity"
                className="inline-flex items-center justify-center rounded-xl border border-[#001161]/15 bg-white/70 px-6 py-3.5 text-[16px] font-bold text-[#001161] transition hover:bg-white"
                style={{ fontFamily: FF }}
              >
                Sešity se slevou 20 %
              </a>
            </div>
          </div>
          <div className="mt-10">
            <HeroCovers books={mathWorkbooks} />
          </div>
        </section>

        <InteractiveSection />
        <FormSection />

        <WorkbooksSection products={products as Product[]} />
        <MethodologySection />
        <TestimonialsSection />
        <FaqSection />
      </main>

      <footer className="bg-[#06124F] px-6 py-8 text-white md:px-12">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
          <Link to="/" className="text-[18px] leading-none text-white/70" style={HEADING}>
            Vividbooks
          </Link>
          <p className="text-[13px] text-white/35" style={{ fontFamily: FF }}>
            © 2026 Vividbooks s.r.o. · <a href="https://www.vividbooks.com" className="hover:text-white/70">vividbooks.com</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default MathPilotLandingPage;
