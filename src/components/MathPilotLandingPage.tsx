/**
 * Pilotáž matematiky 2026/27 — microsite akce z webináře.
 *
 * Nabídka: rok digitální matematiky (1. i 2. stupeň) zdarma a k tomu 20 % sleva na pracovní
 * sešity matematiky. Přihlášky do 31. 12. 2026.
 *
 * Přihláška jde přes Edge funkci `kabinet-trial` do Kabinetu jako běžný trial z webu
 * s poznámkou PILOT_NOTE — škola dostane přístup hned a podle poznámky ho v Kabinetu
 * prodloužíme na celý rok. Žádosti odmítnuté Kabinetem (škola už má trial nebo předplatné)
 * se v Kabinetu zapíšou se stejnou poznámkou, takže je lze dohledat a vyřídit ručně.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Loader2, Minus, Plus, ShoppingCart } from 'lucide-react';
import { SEOHead, faqJsonLd } from './SEOHead';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SubjectTabsSection } from './SubjectTabsSection';
import { MathVoicedVideos } from './MathInteractiveIncluded';
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
import { MATEMATIKA_2_TAB_OVERRIDES } from '../data/matematika2SubjectTabOverrides';
import {
  MATH2_ECOSYSTEM_EXCLUDED_TABS,
  MATH2_ECOSYSTEM_EXTRA_TABS,
  VividLogo,
} from './MathCampaignLandingPage';

const FF = "'Fenomen Sans', sans-serif";
/** Nadpisy pilotáže v Fenomen Sans (Vítek 16. 10. 2026), ne v Cooper jako kampaň matematiky. */
/** Jen hlavní nadpis v hero (Vítek 16. 10. 2026). */
const COOPER = "'Cooper Light', serif";
const HEADING: React.CSSProperties = { fontFamily: FF, fontWeight: 700, letterSpacing: '-0.01em' };

const PILOT_NOTE = 'Pilotáž matematiky 2026/27 (1 rok zdarma, 20 % na sešity)';
const DEADLINE_LABEL = '31. 12. 2026';
const DISCOUNT = 0.2;
const PAGE_PATH = '/kampane/pilotaz-matematiky';

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

/** Sady pro jednoho žáka na ročník: všechny díly řady pro daný ročník. */
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

function SectionTitle({ eyebrow, title, body }: { eyebrow?: string; title: React.ReactNode; body?: React.ReactNode }) {
  return (
    <div className="mx-auto mb-9 max-w-[760px] text-center">
      {eyebrow ? (
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/40" style={{ fontFamily: FF }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-[28px] leading-[1.08] text-[#001161] md:text-[38px]" style={HEADING}>
        {typeof title === 'string' ? formatTypography(title) : title}
      </h2>
      {body ? (
        <p className="mx-auto mt-3 max-w-[640px] text-[15px] leading-relaxed text-[#001161]/65 md:text-[16px]" style={{ fontFamily: FF }}>
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

/** Aplikace, které už mají své video v přehrávači výše — v seznamu se neopakují. */
const APPS_IN_VIDEOS = new Set([
  'Početník',
  'Slovní úlohy',
  'Přijímací zkoušky',
  'Rýsování',
  // mají vlastní záložku v „Co všechno v aplikaci najdete“
  'Rovinné útvary a tělesa',
  'Zlomky',
  'Algebraické dlaždice',
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

        <MathVoicedVideos
          secondStage
          sansTitle
          controls
          className="mt-14 !px-0"
          body="Krátká videa se zvukem: co v pilotáži dostanete a jak s tím pracujete v hodině."
        />

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
            excludeTabTexts={MATH2_ECOSYSTEM_EXCLUDED_TABS}
            extraTabs={MATH2_ECOSYSTEM_EXTRA_TABS}
            tabOverrides={MATEMATIKA_2_TAB_OVERRIDES}
          />
        </div>

        <p className="mt-8 text-[14px] font-bold text-[#001161]/45" style={{ fontFamily: FF }}>
          {formatTypography('A k tomu další aplikace')}
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
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
    <section id="sesity" className="scroll-mt-24 bg-white px-4 py-14 sm:px-6 md:px-12 md:py-16">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle
          eyebrow="Pracovní sešity se slevou 20 %"
          title="Balíčky sešitů matematiky"
          body="Interaktivní matematiku můžete používat i k titulům, které už máte. Pokud chcete naše sešity, vyberte celou řadu nebo jen ročníky, které potřebujete. Zvolte počet žáků a vložte balíček do košíku, sleva už je v ceně."
        />

        {groups.length === 0 ? (
          <p className="text-center text-[14px] text-[#001161]/45" style={{ fontFamily: FF }}>
            Načítám sešity…
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((g) => (
              <SeriesBundle key={g.series.id} {...g} products={products} />
            ))}
          </div>
        )}

        <p className="mx-auto mt-6 max-w-[720px] text-center text-[13px] leading-relaxed text-[#001161]/55" style={{ fontFamily: FF }}>
          {formatTypography(
            'Ceny jsou za sešity pro jednoho žáka, včetně DPH. Ke sešitům pro žáky máte digitální přístup zdarma i po skončení pilotáže (od 15 kusů sešitů).',
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
  pupils,
  products,
  compact = false,
}: {
  bundleId: string;
  pupils: number;
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
    for (const line of lines) addItem({ ...line, quantity: pupils });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
    openCart();
  };

  return (
    <button
      type="button"
      onClick={add}
      aria-label={`Do košíku: ${bundle.title}, ${pupils} ks`}
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

function PupilsStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.max(1, Math.min(999, Math.round(n) || 1)));
  return (
    <div className="inline-flex items-center rounded-xl bg-white ring-1 ring-[#001161]/12" style={{ fontFamily: FF }}>
      <button type="button" aria-label="Méně žáků" onClick={() => set(value - 1)} className="flex h-10 w-9 items-center justify-center text-[#001161]/60 hover:text-[#001161]">
        <Minus className="h-4 w-4" />
      </button>
      <input
        aria-label="Počet žáků"
        inputMode="numeric"
        value={value}
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')))}
        className="h-10 w-12 bg-transparent text-center text-[15px] font-bold text-[#001161] outline-none"
      />
      <button type="button" aria-label="Více žáků" onClick={() => set(value + 1)} className="flex h-10 w-9 items-center justify-center text-[#001161]/60 hover:text-[#001161]">
        <Plus className="h-4 w-4" />
      </button>
    </div>
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
  const [pupils, setPupils] = useState(25);
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
            všech {books.length} sešitů řady pro jednoho žáka
          </p>
          {seriesBundle ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <PupilsStepper value={pupils} onChange={setPupils} />
              <span className="text-[13px] text-[#001161]/55" style={{ fontFamily: FF }}>
                žáků · celkem <strong className="text-[#001161]">{formatKc(pilot * pupils)}</strong>
              </span>
              <AddBundleButton bundleId={pilotBundleId(series.id)} pupils={pupils} products={products} />
            </div>
          ) : null}
        </div>

        {/* po ročnících */}
        <div className="border-t border-[#001161]/8 bg-white/70 p-6 md:border-l md:border-t-0 md:p-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/40" style={{ fontFamily: FF }}>
              Nebo jen jeden ročník
            </p>
            {seriesBundle ? (
              <p className="text-[12px] text-[#001161]/45" style={{ fontFamily: FF }}>
                do košíku po {pupils} ks
              </p>
            ) : null}
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
                <AddBundleButton bundleId={pilotBundleId(series.id, set.grade)} pupils={pupils} products={products} compact />
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
          heading="Jak na… v matematice"
          subheading="Procenta, jednotky, úměrnost, geometrie a rýsování, zlomky, algebraické výrazy i nová témata RVP."
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
  | { kind: 'manual'; message: string };

function PilotForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', position: '', pupils: '' });
  const [schoolName, setSchoolName] = useState('');
  const [ico, setIco] = useState('');
  const [stages, setStages] = useState<number[]>([1, 2]);
  const [wantsWorkbooks, setWantsWorkbooks] = useState(false);
  const [gdpr, setGdpr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleStage = (n: number) =>
    setStages((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n].sort()));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Vyplňte prosím jméno a příjmení.');
    if (!schoolName.trim() || ico.length < 6) return setError('Vyberte prosím školu a doplňte IČO.');
    if (!isValidEmailFormat(form.email.trim())) return setError(EMAIL_FORMAT_HINT_CS);
    if (!form.phone.trim()) return setError('Vyplňte prosím telefon.');
    if (!form.position) return setError('Vyberte prosím svou pozici.');
    if (stages.length === 0) return setError('Vyberte prosím alespoň jeden stupeň.');
    if (!gdpr) return setError('Potřebujeme váš souhlas se zpracováním osobních údajů.');

    const note = [
      PILOT_NOTE,
      `stupně: ${stages.join(' a ')}.`,
      wantsWorkbooks ? `chce sešity se slevou${form.pupils.trim() ? `, cca ${form.pupils.trim()} žáků` : ''}` : 'sešity zatím ne',
    ].join(' · ');

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${KABINET_TRIAL_FN}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
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
          note,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; status?: string; code?: string; message?: string; teacherCode?: string; studentCode?: string }
        | null;

      if (!data) throw new Error(`Server neodpověděl (HTTP ${res.status}).`);
      if (data.code === 'INVALID') {
        setError(data.message || 'Vyplňte prosím všechny povinné údaje.');
        return;
      }
      if (data.ok && (data.status === 'created' || data.status === 'extended') && data.teacherCode && data.studentCode) {
        setOutcome({ kind: 'codes', teacherCode: data.teacherCode, studentCode: data.studentCode });
        return;
      }
      if (data.ok && (data.status === 'created' || data.status === 'extended')) {
        setOutcome({ kind: 'manual', message: 'Přístupové kódy vám pošleme e-mailem.' });
        return;
      }
      if (data.status === 'rejected') {
        // Kabinet žádost zapsal s poznámkou pilotáže; škola už přístup má nebo ho nedávno měla.
        const message =
          data.code === 'HAS_ACTIVE_SUBSCRIPTION'
            ? 'Vaše škola už u nás předplatné má. Ozveme se vám a pilotáž matematiky k němu připojíme.'
            : data.code === 'HAS_ACTIVE_TRIAL'
              ? 'Vaše škola už zkušební přístup má. Ozveme se vám a prodloužíme ho na celý rok.'
              : 'Vaše škola u nás nedávno zkoušela přístup. Ozveme se vám a pilotáž vám nastavíme ručně.';
        setOutcome({ kind: 'manual', message });
        return;
      }
      throw new Error(data.message || `Přihlášku se nepodařilo odeslat (HTTP ${res.status}).`);
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : 'Přihlášku se nepodařilo odeslat.'} Zkuste to prosím znovu, nebo napište na hello@vividbooks.com.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (outcome) {
    return (
      <div className="rounded-[24px] border border-green-200 bg-[#F0FDF4] p-7 text-center md:p-9">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
        <h3 className="text-[26px] text-[#001161]" style={HEADING}>
          Vítejte v pilotáži!
        </h3>
        {outcome.kind === 'codes' ? (
          <>
            <p className="mx-auto mt-2 max-w-[440px] text-[15px] leading-relaxed text-[#001161]/70" style={{ fontFamily: FF }}>
              {formatTypography(
                'Matematiku máte odemčenou hned. Do dvou pracovních dnů vám přístup prodloužíme na celý rok a ozveme se kvůli sešitům.',
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
            <Link
              to="/otevrit"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#001161] px-6 py-3 text-[15px] font-bold text-white transition hover:bg-[#001161]/85"
              style={{ fontFamily: FF }}
            >
              Otevřít aplikaci
            </Link>
          </>
        ) : (
          <p className="mx-auto mt-2 max-w-[440px] text-[15px] leading-relaxed text-[#001161]/70" style={{ fontFamily: FF }}>
            {formatTypography(`Přihlášku máme. ${outcome.message}`)}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-[#001161]/8 md:p-8">
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

        <fieldset className="mt-2">
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
                  onClick={() => toggleStage(n)}
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

        <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-[14px] bg-[#f8f9fc] p-4" style={{ fontFamily: FF }}>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[#7C3AED]"
            checked={wantsWorkbooks}
            onChange={(e) => setWantsWorkbooks(e.target.checked)}
          />
          <span className="text-[14px] leading-snug text-[#001161]">
            <strong>Mám zájem i o pracovní sešity se slevou 20 %</strong>
            <span className="block text-[13px] text-[#001161]/55">Připravíme vám nabídku podle počtu žáků.</span>
          </span>
        </label>
        {wantsWorkbooks ? (
          <input
            className={INPUT}
            placeholder="Přibližný počet žáků (nepovinné)"
            inputMode="numeric"
            value={form.pupils}
            onChange={set('pupils')}
          />
        ) : null}

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

        {error ? (
          <p className="rounded-[12px] bg-red-50 px-4 py-3 text-[14px] text-red-700" style={{ fontFamily: FF }}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-4 text-[16px] font-bold text-white transition hover:bg-[#6D28D9] disabled:opacity-60"
          style={{ fontFamily: FF }}
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          Přihlásit školu do pilotáže
        </button>
        <p className="text-center text-[12px] text-[#001161]/45" style={{ fontFamily: FF }}>
          Přihlášky přijímáme do {DEADLINE_LABEL}.
        </p>
      </div>
    </form>
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
            {formatTypography('Zkuste to s námi celý školní rok')}
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
    question: 'Co se stane po roce?',
    answer:
      'Nic automaticky. Přístup skončí a nic se vám nenaúčtuje. Pokud budete chtít pokračovat, domluvíme se. Ke sešitům pro žáky máte digitální přístup zdarma i dál.',
  },
  {
    question: 'Musíme si objednat pracovní sešity?',
    answer:
      'Ne. Interaktivní matematiku můžete používat k učebnicím a sešitům, které už ve škole máte, a celý rok je zdarma. Když budete chtít učit i s našimi pracovními sešity, objednáte si je se slevou 20 %.',
  },
  {
    question: 'Naše škola už u vás má jiný předmět nebo zkušební přístup.',
    answer:
      'Přihlaste se stejně. Ozveme se vám a pilotáž matematiky k vašemu přístupu připojíme.',
  },
  {
    question: 'Do kdy se můžeme přihlásit?',
    answer: `Přihlášky přijímáme do ${DEADLINE_LABEL}. Rok zdarma počítáme ode dne, kdy vám přístup otevřeme.`,
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
        title="Pilotáž matematiky: rok zdarma"
        path={PAGE_PATH}
        description="Vyzkoušejte matematiku Vividbooks pro 1. i 2. stupeň celý školní rok zdarma. K tomu pracovní sešity matematiky se slevou 20 %. Přihlášky do 31. 12. 2026."
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
              <span className="block">{formatTypography('Máme nejlepší matematiku.')}</span>
              <span className="block md:whitespace-nowrap">{formatTypography('Chceme, aby ji měly rády všechny\u00a0děti.')}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-[16px] leading-relaxed text-[#001161]/70 md:text-[18px]" style={{ fontFamily: FF }}>
              {formatTypography(
                'Proto vám interaktivní verzi dáváme na celý školní rok zdarma. Tiskněte z ní, promítejte ji na tabuli a používejte ji k učebnicím, které už máte, nebo k našim sešitům se slevou 20 %.',
              )}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <PrimaryButton href="#prihlaska">Přihlásit školu do pilotáže</PrimaryButton>
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


        <WorkbooksSection products={products as Product[]} />
        <MethodologySection />
        <FormSection />
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
