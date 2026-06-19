import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CalendarDays, Check, FileText, GripVertical, Library, Mail, PackageCheck, Printer, Upload } from 'lucide-react';
import { SEOHead, faqJsonLd } from './SEOHead';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { getProductImage } from './cartUpsellUtils';
import { useProducts } from '../contexts/ProductsContext';
import logoPaths from '../imports/svg-fupfguvmdt';
import { formatTypography } from '../utils/formatTypography';

const FF = "'Fenomen Sans', sans-serif";
const COOPER = "'Cooper Light', serif";
const BLUE = '#001161';
const VIOLET = '#7C3AED';
const ORANGE = '#E8942A';
const MINT = '#03CA90';
const VIVIDBOOKS_LOGO_VIEWBOX = '0 0 1786.62 869.93';
const CONTACT_EMAIL = 'editor@vividbooks.cz';
const COVER_SHADOW = 'drop-shadow(0 2px 5px rgba(0, 17, 97, 0.1))';

type Chapter = {
  id: string;
  title: string;
  subtitle: string;
  custom?: boolean;
};

const INITIAL_CHAPTERS: Chapter[] = [
  { id: 'intro', title: 'Úvod do fyziky', subtitle: '4 strany' },
  { id: 'mech', title: 'Mechanika', subtitle: '8 stran' },
  { id: 'custom', title: 'Vlastní materiál', subtitle: '+ přidat PDF', custom: true },
  { id: 'elec', title: 'Elektřina', subtitle: '6 stran' },
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function findPhysicsWorkbookImage(products: Array<{ type?: string; name?: string; category?: string; image?: string }>) {
  const physics = products.find((product) => {
    if (product.type !== 'workbook' || !getProductImage(product)) return false;
    const label = `${product.name ?? ''} ${product.category ?? ''}`.toLowerCase();
    return label.includes('fyzik');
  });
  return physics ? getProductImage(physics) : undefined;
}

function T({ children }: { children: string }) {
  return <>{formatTypography(children)}</>;
}

function VividLogo() {
  return (
    <Link to="/" className="inline-flex shrink-0 items-center" aria-label="Vividbooks">
      <svg viewBox={VIVIDBOOKS_LOGO_VIEWBOX} fill="none" className="h-auto w-[88px]">
        <path d={logoPaths.p299c6b00} fill={BLUE} />
        <path d={logoPaths.p3cc4870} fill={BLUE} />
        <path d={logoPaths.p98d9300} fill={BLUE} />
        <path d={logoPaths.pf524b00} fill={BLUE} />
        <path d={logoPaths.p26e2d80} fill={BLUE} />
        <path d={logoPaths.p15998cf0} fill={BLUE} />
        <path d={logoPaths.p1bd3b900} fill={BLUE} />
        <path d={logoPaths.p19a24c00} fill={BLUE} />
        <path d={logoPaths.p34d64300} fill={BLUE} />
        <path d={logoPaths.p396dedf0} fill={BLUE} />
      </svg>
    </Link>
  );
}

function Badge({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'mint' | 'orange' }) {
  const tones = {
    violet: 'bg-[#7C3AED]/10 text-[#7C3AED]',
    mint: 'bg-[#03CA90]/12 text-[#017d5b]',
    orange: 'bg-[#E8942A]/12 text-[#a85b00]',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.14em] ${tones[tone]}`} style={{ fontFamily: FF }}>
      {children}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  body,
  align = 'left',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <div className={`${align === 'center' ? 'mx-auto max-w-[760px] text-center' : 'max-w-[700px]'}`}>
      {eyebrow ? (
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/40" style={{ fontFamily: FF }}>
          <T>{eyebrow}</T>
        </p>
      ) : null}
      <h2 className="text-[30px] leading-[1.08] tracking-[-0.02em] text-[#001161] md:text-[42px]" style={{ fontFamily: COOPER }}>
        {title}
      </h2>
      {body ? (
        <p className={`mt-4 text-[16px] leading-relaxed text-[#001161]/64 md:text-[17px] ${align === 'center' ? 'mx-auto max-w-[640px]' : ''}`} style={{ fontFamily: FF }}>
          {body}
        </p>
      ) : null}
    </div>
  );
}

function PrimaryCta({ className = '' }: { className?: string }) {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}?subject=Z%C3%A1jem%20o%20Editor%20se%C5%A1it%C5%AF`}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3 text-[15px] font-bold text-white shadow-sm transition hover:scale-[1.03] hover:bg-[#6D28D9] active:scale-[0.98] ${className}`}
      style={{ fontFamily: FF }}
    >
      Mám zájem
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function DragCursor({ pressing }: { pressing: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute z-30"
      animate={{ scale: pressing ? 0.9 : 1 }}
      transition={{ duration: 0.18 }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path d="M5 3l14 9-6 1-3 7z" fill={BLUE} stroke="white" strokeWidth="1.4" />
      </svg>
      {pressing ? (
        <span className="absolute -bottom-3 left-3 h-3 w-3 rounded-full border border-[#001161]/15 bg-white/80 shadow-sm" />
      ) : null}
    </motion.div>
  );
}

function EditorHeroMockup({ physicsCover }: { physicsCover?: string }) {
  const [chapters, setChapters] = useState(INITIAL_CHAPTERS);
  const [activeId, setActiveId] = useState('intro');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ x: 132, y: 18, pressing: false });
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reduceMotion) return undefined;

    let cancelled = false;

    const run = async () => {
      while (!cancelled) {
        setChapters(INITIAL_CHAPTERS);
        setActiveId('intro');
        setDraggingId(null);
        setCursor({ x: 132, y: 18, pressing: false });
        await sleep(1800);
        if (cancelled) return;

        setCursor({ x: 20, y: 64, pressing: false });
        await sleep(650);
        if (cancelled) return;

        setCursor({ x: 20, y: 64, pressing: true });
        setDraggingId('mech');
        await sleep(280);
        if (cancelled) return;

        setCursor({ x: 20, y: 4, pressing: true });
        await sleep(520);
        if (cancelled) return;

        setChapters([
          INITIAL_CHAPTERS[1],
          INITIAL_CHAPTERS[0],
          INITIAL_CHAPTERS[2],
          INITIAL_CHAPTERS[3],
        ]);
        setActiveId('mech');
        await sleep(320);
        if (cancelled) return;

        setCursor({ x: 20, y: 4, pressing: false });
        setDraggingId(null);
        await sleep(2200);
        if (cancelled) return;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [reduceMotion]);

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="absolute -right-5 -top-5 hidden rounded-2xl border border-[#001161]/8 bg-white px-4 py-3 text-[13px] font-bold text-[#001161] shadow-[0_18px_50px_rgba(0,17,97,0.12)] md:flex md:items-center md:gap-2" style={{ fontFamily: FF }}>
        <span className="h-2.5 w-2.5 rounded-full bg-[#03CA90]" />
        Sešit připraven k tisku
      </div>
      <div className="absolute -bottom-5 -left-4 hidden rounded-2xl border border-[#001161]/8 bg-white px-4 py-3 text-[13px] font-bold text-[#001161] shadow-[0_18px_50px_rgba(0,17,97,0.12)] md:flex md:items-center md:gap-2" style={{ fontFamily: FF }}>
        <CalendarDays className="h-4 w-4 text-[#E8942A]" />
        84 stran · doručení do školy
      </div>

      <div className="overflow-hidden rounded-[30px] border border-[#001161]/10 bg-white shadow-[0_28px_90px_rgba(0,17,97,0.14)]">
        <div className="flex h-11 items-center gap-2 border-b border-[#001161]/8 bg-[#f5f7fd] px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="ml-2 flex h-5 flex-1 items-center rounded-md bg-white/80 px-3">
            <span className="truncate text-[11px] font-bold text-[#001161]/42" style={{ fontFamily: FF }}>
              Můj sešit fyziky
            </span>
          </div>
        </div>

        <div className="grid min-h-[330px] grid-cols-[145px_1fr] sm:grid-cols-[190px_1fr]">
          <aside className="relative border-r border-[#001161]/8 bg-[#fafbff] p-3 sm:p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#001161]/35" style={{ fontFamily: FF }}>
              Kapitoly
            </p>

            <div className="relative">
              <AnimatePresence initial={false}>
                {chapters.map((chapter) => {
                  const isActive = chapter.id === activeId;
                  const isDragging = chapter.id === draggingId;
                  return (
                    <motion.div
                      key={chapter.id}
                      layout
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className={`mb-2 rounded-xl border p-2.5 ${
                        isDragging
                          ? 'border-[#7C3AED]/45 bg-white shadow-[0_14px_30px_rgba(124,58,237,0.18)]'
                          : isActive
                            ? 'border-[#7C3AED]/30 bg-[#7C3AED]/8'
                            : 'border-[#001161]/8 bg-white'
                      }`}
                      style={{ zIndex: isDragging ? 20 : 1 }}
                    >
                      <div className="flex items-center gap-1.5">
                        <GripVertical className={`h-3.5 w-3.5 ${isDragging ? 'text-[#7C3AED]' : 'text-[#001161]/28'}`} />
                        <p className="text-[12px] font-bold leading-tight text-[#001161]" style={{ fontFamily: FF }}>
                          {chapter.title}
                        </p>
                      </div>
                      <p
                        className={`mt-1 pl-5 text-[11px] ${
                          chapter.custom ? 'font-bold text-[#03a978]' : 'text-[#001161]/46'
                        }`}
                        style={{ fontFamily: FF }}
                      >
                        {chapter.subtitle}
                      </p>
                      {isDragging ? (
                        <p className="mt-1 pl-5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#7C3AED]" style={{ fontFamily: FF }}>
                          přesouvám…
                        </p>
                      ) : null}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {!reduceMotion ? (
                <motion.div
                  className="absolute left-0 top-[34px]"
                  animate={{ x: cursor.x, y: cursor.y }}
                  transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
                >
                  <DragCursor pressing={cursor.pressing} />
                </motion.div>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl bg-[#001161] px-3 py-2.5 text-center text-[12px] font-bold text-white" style={{ fontFamily: FF }}>
              Odeslat k tisku
            </div>
          </aside>

          <div className="flex items-center justify-center p-5 sm:p-6">
            <div className="w-full max-w-[220px]">
              <div className="relative overflow-hidden rounded-[18px] border border-[#7C3AED]/25 bg-[#0b1530] shadow-[0_0_0_4px_rgba(124,58,237,0.1)]">
                {physicsCover ? (
                  <ImageWithFallback
                    src={physicsCover}
                    alt="Můj sešit fyziky"
                    priority
                    className="h-[280px] w-full object-cover object-top"
                    style={{ filter: COVER_SHADOW }}
                  />
                ) : (
                  <div className="flex h-[280px] flex-col justify-end bg-gradient-to-br from-[#0b1530] via-[#14244f] to-[#1d3f7a] p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45" style={{ fontFamily: FF }}>
                      Vividbooks
                    </p>
                    <p className="mt-2 text-[28px] leading-none text-white" style={{ fontFamily: COOPER }}>
                      Fyzika
                    </p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#001161]/88 via-[#001161]/35 to-transparent px-4 pb-4 pt-16">
                  <p className="text-[15px] font-bold text-white" style={{ fontFamily: FF }}>
                    Můj sešit fyziky
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-white/55" style={{ fontFamily: FF }}>
                    84 stran · vlastní pořadí kapitol
                  </p>
                </div>
              </div>
              <p className="mt-4 text-center text-[12px] leading-relaxed text-[#001161]/48" style={{ fontFamily: FF }}>
                Náhled vašeho sešitu — obálka i obsah se aktualizují podle úprav v editoru.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const steps = [
  {
    title: 'Sestavíte si sešit',
    body: 'V jednoduchém online editoru vyberete materiály Vividbooks, přidáte vlastní PDF a seřadíte kapitoly podle svého plánu.',
  },
  {
    title: 'Zkontrolujete náhled',
    body: 'Před odesláním uvidíte dvojstrany, obálku i číslování. Sešit vypadá stejně jako ve finálním tisku.',
  },
  {
    title: 'My vytiskneme a doručíme',
    body: 'Objednávky uzavíráme 1. září, tiskneme je společně a do 20. září doručíme hotové sešity přímo do školy.',
  },
];

const benefits = [
  {
    icon: Library,
    title: 'Váš obsah i Vividbooks',
    body: 'Kombinujte ověřené kapitoly, pracovní listy a vlastní materiály z kabinetu v jednom svázaném sešitě.',
  },
  {
    icon: Upload,
    title: 'Přesně podle ŠVP',
    body: 'Změňte pořadí témat, přidejte prázdné stránky nebo poskládejte variantu pro konkrétní třídu.',
  },
  {
    icon: Printer,
    title: 'Konec tisku ve sborovně',
    body: 'Místo kopírek a volných listů dostanou žáci jeden profesionálně vytištěný pracovní sešit.',
  },
  {
    icon: PackageCheck,
    title: 'Doručení do školy',
    body: 'Tisk, kompletaci i doručení řeší Vividbooks. Vy si jen pohlídáte uzávěrku objednávek.',
  },
];

const formats = [
  {
    pages: '84',
    title: '84 stran',
    subtitle: 'A4 · sešitová vazba',
    body: 'Kompaktní varianta pro jeden předmět, pololetí nebo kratší tematický celek.',
    tone: 'light',
    points: ['Ideální pro 1 předmět', 'Nižší cena za kus', 'Rychlé sestavení'],
  },
  {
    pages: '120',
    title: '120 stran',
    subtitle: 'A4 · lepená vazba',
    body: 'Roční varianta s větším prostorem pro výklad, pracovní listy i vlastní stránky.',
    tone: 'dark',
    points: ['Celý rok v jednom sešitě', 'Více vlastních materiálů', 'Lze kombinovat témata'],
  },
];

export function WorkbookEditorLandingPage() {
  const { products } = useProducts();
  const physicsCover = useMemo(() => findPhysicsWorkbookImage(products), [products]);

  return (
    <div className="min-h-screen bg-white text-[#001161]" style={{ fontFamily: FF }}>
      <SEOHead
        title="Editor sešitů"
        path="/kampane/editor-sesitu"
        description="Sestavte si vlastní pracovní sešit z materiálů Vividbooks i vlastních podkladů. Vividbooks jej vytiskne a doručí do školy."
        jsonLd={faqJsonLd([
          {
            question: 'Co je Editor sešitů Vividbooks?',
            answer: 'Služba pro školy, ve které si učitel sestaví vlastní pracovní sešit z materiálů Vividbooks a vlastních PDF podkladů.',
          },
          {
            question: 'Kolik stojí vlastní sešit?',
            answer: 'Orientační cena je 135 Kč za žáka. Minimální odběr je 15 kusů jedné varianty.',
          },
          {
            question: 'Do kdy je potřeba objednat?',
            answer: 'Uzávěrka objednávek je 1. září a doručení do školy plánujeme do 20. září.',
          },
        ])}
      />

      <header className="sticky top-0 z-50 border-b border-[#001161]/8 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 md:px-10">
          <VividLogo />
          <nav className="hidden items-center gap-5 md:flex" aria-label="Navigace kampaně">
            {[
              ['#jak-to-funguje', 'Jak to funguje'],
              ['#proc', 'Proč editor'],
              ['#varianty', 'Varianty'],
              ['#cena', 'Cena'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-[14px] font-bold text-[#001161]/56 transition hover:text-[#001161]">
                {label}
              </a>
            ))}
          </nav>
          <PrimaryCta className="px-4 py-2.5 text-[13px]" />
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#f3eeff] px-4 pb-16 pt-10 sm:px-6 md:px-10 md:pb-20 md:pt-14">
          <div className="absolute -right-28 -top-28 h-[420px] w-[420px] rounded-full bg-[#7C3AED]/12 blur-3xl" />
          <div className="absolute -bottom-24 left-0 h-[360px] w-[360px] rounded-full bg-[#03CA90]/14 blur-3xl" />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[0.96fr_1.04fr]">
            <div className="text-center lg:text-left">
              <Badge tone="violet">Novinka 2025</Badge>
              <h1 className="mt-5 text-[42px] leading-[0.98] tracking-[-0.035em] text-[#001161] sm:text-[54px] md:text-[66px]" style={{ fontFamily: COOPER }}>
                Pracovní sešit přesně podle vás
              </h1>
              <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-[#001161]/68 md:text-[19px] lg:mx-0">
                <T>Naklikejte si vlastní sešit z materiálů Vividbooks i vlastních podkladů. My ho profesionálně vytiskneme a doručíme do školy před začátkem školního roku.</T>
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
                <PrimaryCta className="px-6 py-3.5" />
                <a href="#jak-to-funguje" className="inline-flex items-center justify-center rounded-xl border border-[#001161]/12 bg-white/65 px-5 py-3 text-[15px] font-bold text-[#001161] transition hover:bg-white">
                  Jak to funguje?
                </a>
              </div>
              <div className="mt-9 grid grid-cols-3 gap-3 border-t border-[#001161]/10 pt-6 text-left">
                {[
                  ['450+', 'škol používá Vividbooks'],
                  ['77 %', 'učitelů má zájem'],
                  ['135 Kč', 'orientačně za sešit'],
                ].map(([value, label]) => (
                  <div key={value}>
                    <p className="text-[25px] font-bold leading-none text-[#001161] md:text-[30px]" style={{ fontFamily: FF }}>
                      {value}
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-[#001161]/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <EditorHeroMockup physicsCover={physicsCover} />
          </div>
        </section>

        <section id="jak-to-funguje" className="scroll-mt-24 bg-[#f5f7fd] px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-[1200px]">
            <SectionTitle
              align="center"
              eyebrow="Postup"
              title="Tři kroky a sešit je váš"
              body={<T>Celý proces zvládnete za odpoledne. Žádné grafické znalosti, žádný složitý software.</T>}
            />
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => (
                <article key={step.title} className="relative rounded-[26px] border border-[#001161]/8 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_55px_rgba(0,17,97,0.09)]">
                  <p className="text-[48px] font-bold leading-none text-[#7C3AED]/12" style={{ fontFamily: FF }}>
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-5 text-[24px] leading-tight text-[#001161]" style={{ fontFamily: COOPER }}>
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#001161]/62">
                    <T>{step.body}</T>
                  </p>
                  {index < steps.length - 1 ? (
                    <ArrowRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-[#7C3AED] md:block" />
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="proc" className="scroll-mt-24 px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[1fr_0.86fr]">
            <div>
              <SectionTitle
                eyebrow="Proč editor"
                title="Hotový sešit nikdy přesně nesedí. Teď nemusí."
                body={<T>Učitel ví nejlépe, co třída potřebuje. Editor z toho udělá hotový sešit bez kompromisů mezi osnovou, tempem a dostupnými materiály.</T>}
              />
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {benefits.map((benefit) => {
                  const Icon = benefit.icon;
                  return (
                    <article key={benefit.title} className="rounded-[22px] border border-[#001161]/8 bg-white p-5 shadow-sm">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3eeff] text-[#7C3AED]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-[18px] font-bold leading-tight text-[#001161]" style={{ fontFamily: FF }}>
                        {benefit.title}
                      </h3>
                      <p className="mt-2 text-[14px] leading-relaxed text-[#001161]/60">
                        <T>{benefit.body}</T>
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-[30px] bg-[#001161] p-7 text-white shadow-[0_24px_80px_rgba(0,17,97,0.2)] md:p-9">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/38" style={{ fontFamily: FF }}>
                Z průzkumu mezi 97 učiteli
              </p>
              <p className="mt-5 text-[70px] font-bold leading-none" style={{ fontFamily: FF }}>
                <span className="text-[#03CA90]">77 %</span>
              </p>
              <p className="mt-3 text-[16px] leading-relaxed text-white/60">
                <T>učitelů by takovou službu využilo. Zájem potvrzují odpovědi z pěti kol průzkumu.</T>
              </p>
              <div className="my-7 h-px bg-white/10" />
              <blockquote className="text-[15px] italic leading-relaxed text-white/72">
                „Naprosto perfektní nápad. Vím, co potřebují děti a co musím splnit v rámci ŠVP — a takhle to mohu konečně skloubit.“
              </blockquote>
              <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.12em] text-[#03CA90]">Učitelka přírodopisu, ZŠ</p>
              <div className="my-7 h-px bg-white/10" />
              <blockquote className="text-[15px] italic leading-relaxed text-white/72">
                „V matematice jsou témata řazena jinak než u nás. Tato nabídka mi to konečně řeší.“
              </blockquote>
              <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.12em] text-[#03CA90]">Učitelka matematiky, ZŠ</p>
            </aside>
          </div>
        </section>

        <section id="varianty" className="scroll-mt-24 bg-white px-4 pb-16 sm:px-6 md:px-10 md:pb-20">
          <div className="mx-auto max-w-[1200px]">
            <SectionTitle
              align="center"
              eyebrow="Varianty"
              title="Vyberte si formát a obsah"
              body={<T>Dvě velikosti sešitu, neomezené možnosti obsahu. Kombinujte materiály Vividbooks, vlastní PDF a stránky pro poznámky.</T>}
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {formats.map((format) => {
                const dark = format.tone === 'dark';
                return (
                  <article key={format.title} className={`rounded-[26px] border p-6 transition hover:-translate-y-1 ${dark ? 'border-[#001161]/10 bg-[#001161] text-white shadow-[0_18px_60px_rgba(0,17,97,0.14)]' : 'border-[#001161]/8 bg-[#f5f7fd] text-[#001161]'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`flex w-14 shrink-0 items-center justify-center rounded-xl border-2 border-[#7C3AED] ${format.pages === '120' ? 'h-20' : 'h-16'} ${dark ? 'bg-white/10' : 'bg-white'}`}>
                        <span className={`text-[15px] font-bold ${dark ? 'text-[#03CA90]' : 'text-[#7C3AED]'}`} style={{ fontFamily: FF }}>
                          {format.pages}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-[28px] leading-tight" style={{ fontFamily: COOPER }}>
                          {format.title}
                        </h3>
                        <p className={`mt-1 text-[13px] font-bold ${dark ? 'text-white/45' : 'text-[#001161]/48'}`}>{format.subtitle}</p>
                      </div>
                    </div>
                    <p className={`mt-5 text-[15px] leading-relaxed ${dark ? 'text-white/64' : 'text-[#001161]/62'}`}>
                      <T>{format.body}</T>
                    </p>
                    <div className="mt-5 grid gap-2">
                      {format.points.map((point) => (
                        <div key={point} className={`flex items-center gap-2 text-[14px] font-bold ${dark ? 'text-white/64' : 'text-[#001161]/62'}`}>
                          <Check className="h-4 w-4 text-[#03CA90]" />
                          {point}
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-6 rounded-[26px] border border-[#03CA90]/20 bg-[#03CA90]/8 p-6">
              <h3 className="text-[22px] leading-tight text-[#001161]" style={{ fontFamily: COOPER }}>
                Co si můžete do sešitu vložit
              </h3>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {[
                  [Library, 'Materiály Vividbooks', 'Celá knihovna pracovních listů a výkladových stránek.'],
                  [FileText, 'Vlastní PDF', 'Pracovní listy, testy nebo materiály, které už ve škole používáte.'],
                  [Mail, 'Prázdné stránky', 'Prostor pro žákovské poznámky, kresby nebo vlastní zadání.'],
                ].map(([Icon, title, body]) => {
                  const TypedIcon = Icon as typeof Library;
                  return (
                    <div key={String(title)} className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#03a978] shadow-sm">
                        <TypedIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[15px] font-bold text-[#001161]">{String(title)}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-[#001161]/58">
                          <T>{String(body)}</T>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="cena" className="scroll-mt-24 bg-[#f3eeff] px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto grid max-w-[1200px] items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Badge tone="orange">Cena</Badge>
              <h2 className="mt-4 text-[34px] leading-[1.05] text-[#001161] md:text-[46px]" style={{ fontFamily: COOPER }}>
                Férová cena, bez skrytých poplatků
              </h2>
              <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-[#001161]/64">
                <T>Platíte jen za tisk — přibližně o 10 Kč více než u standardních sešitů. Za sešit sestavený přesně pro vás.</T>
              </p>
              <PrimaryCta className="mt-7 px-6 py-3.5" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Standardní sešit', '~125 Kč', 'Hotový titul z katalogu Vividbooks. Pevná struktura, dostupný hned.'],
                ['Editor sešitů', '135 Kč', 'Váš vlastní sešit. Váš obsah. Vaše pořadí. Profesionální tisk.'],
              ].map(([label, price, body], index) => (
                <article key={label} className={`rounded-[24px] border bg-white p-6 ${index === 1 ? 'border-[#7C3AED]/35 shadow-[0_18px_55px_rgba(124,58,237,0.14)]' : 'border-[#001161]/8'}`}>
                  <p className={`text-[12px] font-bold uppercase tracking-[0.13em] ${index === 1 ? 'text-[#7C3AED]' : 'text-[#001161]/40'}`}>
                    {label}
                  </p>
                  <p className={`mt-3 text-[36px] font-bold leading-none ${index === 1 ? 'text-[#7C3AED]' : 'text-[#001161]'}`} style={{ fontFamily: FF }}>
                    {price}
                  </p>
                  <p className="mt-1 text-[13px] font-bold text-[#001161]/44">za žáka</p>
                  <p className="mt-5 border-t border-[#001161]/8 pt-4 text-[14px] leading-relaxed text-[#001161]/58">
                    <T>{body}</T>
                  </p>
                </article>
              ))}
              <div className="rounded-[24px] border border-[#E8942A]/35 bg-[#fff7ed] p-5 sm:col-span-2">
                <div className="flex gap-3">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#E8942A]" />
                  <p className="text-[14px] leading-relaxed text-[#8a4b00]">
                    <strong>Uzávěrka objednávek: 1. září.</strong> Všechny sešity se tisknou společně v jedné dávce a doručujeme do <strong>20. září</strong>. Minimální odběr je 15 kusů jedné varianty.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="dotaznik" className="bg-[#001161] px-4 py-20 text-center sm:px-6 md:px-10 md:py-24">
          <div className="mx-auto max-w-[760px]">
            <Badge tone="mint">Spouštíme službu</Badge>
            <h2 className="mt-5 text-[38px] leading-[1.02] tracking-[-0.02em] text-white md:text-[58px]" style={{ fontFamily: COOPER }}>
              Připraveni sestavit váš sešit?
            </h2>
            <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-white/58">
              <T>Služba se spouští — dejte nám vědět a my vás jako první oslovíme, jakmile bude editor připraven.</T>
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Z%C3%A1jem%20o%20Editor%20se%C5%A1it%C5%AF`}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-[#03CA90] px-7 py-4 text-[16px] font-bold text-white shadow-[0_18px_55px_rgba(3,202,144,0.28)] transition hover:scale-[1.03] hover:bg-[#02a374]"
            >
              Mám zájem, napište mi
              <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-4 text-[13px] text-white/35">Nebo nás kontaktujte přímo na {CONTACT_EMAIL} · bez závazků</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default WorkbookEditorLandingPage;
