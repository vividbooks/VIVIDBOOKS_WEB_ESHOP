import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { SEOHead, faqJsonLd } from './SEOHead';
import logoPaths from '../imports/svg-fupfguvmdt';
import { formatTypography } from '../utils/formatTypography';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const FF = "'Fenomen Sans', sans-serif";
const COOPER = "'Cooper Light', serif";
const BLUE = '#001161';
const VIVIDBOOKS_LOGO_VIEWBOX = '0 0 1786.62 869.93';
const CONTACT_EMAIL = 'hello@vividbooks.com';
const PAGE_PATH = '/poradim-se-s-ai';

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
    violet: 'bg-[#6E3BF0]/10 text-[#6E3BF0]',
    mint: 'bg-[#03CA90]/12 text-[#017d5b]',
    orange: 'bg-[#E8942A]/12 text-[#a85b00]',
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.14em] ${tones[tone]}`} style={{ fontFamily: FF }}>
      {children}
    </span>
  );
}

function SectionTitle({ eyebrow, title, body, align = 'left' }: { eyebrow?: string; title: React.ReactNode; body?: React.ReactNode; align?: 'left' | 'center' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-[760px] text-center' : 'max-w-[700px]'}>
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

function PrimaryCta({ className = '', label = 'Chci nezávaznou konzultaci', onColor = false }: { className?: string; label?: string; onColor?: boolean }) {
  return (
    <a
      href="#konzultace"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-bold shadow-sm transition hover:scale-[1.03] active:scale-[0.98] ${onColor ? 'bg-[#FFDD00] text-[#0F1B6B] hover:bg-[#ffe633]' : 'bg-[#6E3BF0] text-white hover:bg-[#5a2fd6]'} ${className}`}
      style={{ fontFamily: FF }}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

/** Aktivity výzvy (PpŽP – specifická část) a co k nim dodá Vividbooks. */
const activities = [
  { code: 'Aktivita 2 · povinná', title: 'Vnitřní pravidla pro bezpečné využívání AI ve škole', ours: 'Vzor školních pravidel: co se s AI smí, jak chránit data žáků a kdo za co odpovídá.' },
  { code: 'Aktivita 3', title: 'Přípravy na výuku s využitím AI', ours: 'AI připraví aktivity z ověřených materiálů. Odpovídají učivu a ročníku, učitel je zkontroluje a upraví.' },
  { code: 'Aktivita 4', title: 'AI a zpětná vazba při sledování pokroku žáka', ours: 'Testy, které se na 2. stupni opravují samy, a přehled nejtěžších otázek.' },
  { code: 'Aktivita 6', title: 'Řízení školy ve spojitosti s pedagogickou praxí', ours: 'AI expert připraví s vedením agentní systémy, které ubírají papírování a uvolní čas na výuku.' },
  { code: 'Aktivity 2–9', title: 'Povinné vzdělávání pedagogů', ours: 'Workshopy pro sborovnu a individuální konzultace do povinných 16 + 10 hodin.' },
];

/** Ukázky z aplikace (obrázky z public/). */
const showcase = [
  {
    src: '/aplikace/news-01-knihovna.png',
    overlay: '/app-uvod/workbooks.png',
    pos: 'object-right-top',
    title: 'Knihovna s doložkou MŠMT',
    body: 'Lekce, pracovní listy, testy a metodiky pro 1. i 2. stupeň, včetně tištěných pracovních sešitů.',
  },
  {
    src: '/aplikace/news-02-ai.png',
    pos: 'object-center',
    title: 'AI z ověřených dat',
    body: 'Vividbooks AI tvoří úlohy přímo z materiálů knihovny, ne z náhodných zdrojů na internetu. Díky tomu nehalucinuje a nevzniká generický obsah, který žákům nic nedá.',
  },
  {
    src: '/vividboard/ai-grading.webp',
    pos: 'object-left-top',
    title: 'Testy, procvičování a hodnocení',
    body: 'Žáci kromě výuky píšou testy a procvičují. Na 2. stupni se testy opravují samy a s hodnocením vám pomůžeme.',
  },
];

/** Ceník licencí (za školu a rok, vč. DPH). Ceny drž jen tady. */
const plans = [
  {
    name: 'AI pro učitele',
    price: 15000,
    tagline: 'Pro celou sborovnu',
    points: [
      'Vividbooks AI pro všechny učitele školy',
      'Knihovna materiálů, vividboard a testy',
      'Veškeré náklady na AI (tokeny) jsou v ceně licence',
    ],
    covers: 'Aktivity 3 a 4',
  },
  {
    name: 'AI pro žáky',
    price: 49900,
    tagline: 'Pro žáky celé školy',
    points: [
      'Licence Vividbooks pro žáky',
      'AI pro žáky v bezpečném prostředí: učitel určuje, s čím pracují',
      'Veškeré náklady na AI (tokeny) jsou v ceně licence',
    ],
    covers: 'Aktivity 3 a 4',
  },
];

/** Placené vzdělávání k licencím (vč. DPH). */
const trainings = [
  { name: 'Workshop pro sborovnu', price: '25 000 Kč', period: 'jednorázově', body: 'Prezenčně ve škole, 8 × 45 minut, tedy polovina povinného společného vzdělávání. Učitelé si s Vividbooks AI připraví vlastní hodinu.' },
  { name: 'AI expert pro vedení školy', price: '149 000 Kč', period: 'za rok', body: 'Náš AI expert s vedením navrhne a nastaví agentní systémy, které ubírají papírování: dokumenty, komunikaci, plánování i ŠVP. Obsahuje tři workshopy a individuální školení pro vedení školy i správce IT.' },
  { name: 'Individuální konzultace', price: 'podle rozsahu', period: '', body: 'Pro jednotlivé učitele během projektu, do povinného individuálního vzdělávání.' },
];

const czk = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`;

const faq = [
  {
    question: 'Jak doložíme, že jsme se AI věnovali už v roce 2025?',
    answer: 'Pozvánkami, sylaby, prezenčními listinami, doklady o spolupráci se školami nebo životopisem učitele, který kolegy školil. Musí jít o pravidelnou činnost, kterou jste sami vedli. Účast na cizím školení ani čestné prohlášení nestačí. Pokud to vaše škola nesplní, může být žadatelem jiná ze spolupracujících škol.',
  },
  {
    question: 'Musíme si sami najít spolupracující školy?',
    answer: 'Ano, aspoň pět škol nejméně dvou druhů (MŠ, ZŠ, SŠ). Každá smí být jen v jednom projektu. Pokud je hledáte, poradíme.',
  },
  {
    question: 'Kolik nás to bude stát?',
    answer: 'Škola jako žadatel hradí nejméně 5 % nákladů projektu, zapojené školy nic. Záloha je až 50 % u projektu do 5 mil. Kč, nad tuto částku nejvýš 30 %. Licence jsou z projektu placené jen po dobu jeho trvání.',
  },
  {
    question: 'Musíme dodavatele vybírat ve výběrovém řízení?',
    answer: 'Cenu nad 50 000 Kč vč. DPH doložíte v rozpočtu průzkumem trhu. Nad 750 000 Kč bez DPH je povinné výběrové řízení a počítá se součet za všechny roky a školy. Naše nabídka slouží jako podklad do průzkumu trhu.',
  },
  {
    question: 'Kdy se dozvíme výsledek?',
    answer: 'Hodnotit se začne po uzávěrce 30. 12. 2026, podle MŠMT nejméně šest měsíců.',
  },
];

const TEACHER_OPTIONS = ['do 10', '10–20', '20–40', 'více než 40'];
const CONSORTIUM_OPTIONS = ['Ještě nevíme', 'Hledáme partnerské školy', 'Partnery už máme', 'Podáváme sami'];

function LeadForm() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    school: '',
    ico: '',
    role: '',
    teachers: '',
    consortium: '',
    message: '',
    website: '',
    gdpr: false,
  });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/poradim-se-s-ai/zajem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ ...form, source: params.get('utm_source') || params.get('utm_campaign') || 'web' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Odeslání se nepovedlo.');
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odeslání se nepovedlo.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-[26px] bg-white p-8 text-center text-[#001161]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#6E3BF0]/15 text-[#6E3BF0]">
          <Check className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-[28px] leading-tight" style={{ fontFamily: COOPER }}>
          Děkujeme, ozveme se
        </h3>
        <p className="mx-auto mt-3 max-w-[420px] text-[15px] leading-relaxed text-[#001161]/62">
          <T>Do dvou pracovních dnů vám zavoláme nebo napíšeme a domluvíme termín konzultace.</T>
        </p>
      </div>
    );
  }

  const input =
    'w-full rounded-xl border border-[#001161]/12 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none transition focus:border-[#6E3BF0] focus:ring-2 focus:ring-[#6E3BF0]/20';
  const label = 'mb-1.5 block text-[13px] font-bold text-[#001161]/70';

  return (
    <form onSubmit={submit} className="rounded-[26px] bg-white p-6 text-left text-[#001161] md:p-8" style={{ fontFamily: FF }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={label}>Škola *</span>
          <input required className={input} value={form.school} onChange={set('school')} placeholder="ZŠ …" />
        </label>
        <label>
          <span className={label}>Jméno a příjmení *</span>
          <input required className={input} value={form.name} onChange={set('name')} autoComplete="name" />
        </label>
        <label>
          <span className={label}>E-mail *</span>
          <input required type="email" className={input} value={form.email} onChange={set('email')} autoComplete="email" />
        </label>
        <label>
          <span className={label}>Telefon</span>
          <input type="tel" className={input} value={form.phone} onChange={set('phone')} autoComplete="tel" />
        </label>
        <label>
          <span className={label}>Kolik máte pedagogů?</span>
          <select className={input} value={form.teachers} onChange={set('teachers')}>
            <option value="">Vyberte</option>
            {TEACHER_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>Partnerské školy</span>
          <select className={input} value={form.consortium} onChange={set('consortium')}>
            <option value="">Vyberte</option>
            {CONSORTIUM_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden />
      <label className="mt-4 flex items-start gap-3 text-[13px] leading-relaxed text-[#001161]/60">
        <input type="checkbox" required checked={form.gdpr} onChange={set('gdpr')} className="mt-1 h-4 w-4 accent-[#6E3BF0]" />
        <span>Souhlasím, aby mě Vividbooks kontaktoval kvůli konzultaci k výzvě. Údaje použijeme jen k tomu.</span>
      </label>
      {error ? <p className="mt-3 text-[14px] font-bold text-[#c0392b]">{error}</p> : null}
      <button
        type="submit"
        disabled={state === 'sending'}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6E3BF0] px-6 py-4 text-[16px] font-bold text-white transition hover:bg-[#5a2fd6] disabled:opacity-60"
      >
        {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Domluvit konzultaci zdarma
      </button>
    </form>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#001161]/10">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 py-5 text-left" aria-expanded={open}>
        <span className="text-[17px] font-bold text-[#001161]">{question}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[#001161]/40 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <p className="pb-5 text-[15px] leading-relaxed text-[#001161]/62">
          <T>{answer}</T>
        </p>
      ) : null}
    </div>
  );
}

const SHADOW = 'shadow-[0_30px_80px_rgba(0,17,97,0.18)]';

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`absolute flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] font-bold text-[#0F1B6B] shadow-[0_14px_34px_rgba(0,17,97,0.16)] ${className}`}>
      <Check className="h-4 w-4 text-[#6E3BF0]" />
      {children}
    </div>
  );
}

/** Obrázek v úvodu: knihovna, sešity a AI, která tvoří otázku z obsahu. */
function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] pb-28">
      <div className={`ml-auto w-[88%] overflow-hidden rounded-[26px] border-[6px] border-white bg-white ${SHADOW}`}>
        <img src="/aplikace/news-01-knihovna.png" alt="Knihovna Vividbooks" className="block aspect-[5/4] w-full object-cover object-top" />
      </div>
      <div className="absolute -left-2 bottom-0 w-[44%] overflow-hidden rounded-[18px] border-4 border-white bg-white shadow-[0_24px_60px_rgba(0,17,97,0.22)] md:-left-8">
        <img src="/vividboard/tool-ai.webp" alt="AI vytváří otázku z obsahu výuky" className="block w-full" />
      </div>
      <Chip className="-left-2 top-6 md:-left-8">Doložka MŠMT</Chip>
      <Chip className="-left-2 top-20 md:-left-8">AI z ověřených dat</Chip>
    </div>
  );
}

export function PoradimSeSAiLandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#001161]" style={{ fontFamily: FF }}>
      <SEOHead
        title="Poradím se s AI – projekt pro vaši školu"
        path={PAGE_PATH}
        description="Výzva OP JAK Poradím se s AI: Vividbooks pomůže škole připravit projekt, proškolí pedagogy a dodá AI nástroje pro výuku. Konzultace zdarma, žádosti do 30. 12. 2026."
        jsonLd={faqJsonLd(faq)}
      />

      <header className="sticky top-0 z-50 border-b border-[#001161]/8 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 md:px-10">
          <VividLogo />
          <nav className="hidden items-center gap-5 md:flex" aria-label="Navigace stránky">
            {[
              ['#vyzva', 'Výzva v kostce'],
              ['#ukazky', 'Ukázky'],
              ['#aktivity', 'Co dodáme'],
              ['#cenik', 'Ceník'],
              ['#otazky', 'Otázky'],
            ].map(([href, text]) => (
              <a key={href} href={href} className="text-[14px] font-bold text-[#001161]/56 transition hover:text-[#001161]">
                {text}
              </a>
            ))}
          </nav>
          <PrimaryCta className="px-4 py-2.5 text-[13px]" label="Konzultace zdarma" />
        </div>
      </header>

      <main>
        <section className="relative mx-3 mt-3 overflow-hidden rounded-[36px] bg-[#E0E5F8] px-5 pb-16 pt-10 text-[#0F1B6B] sm:px-8 md:mx-6 md:px-12 md:pb-20 md:pt-14">
          <div className="absolute -right-28 -top-28 h-[460px] w-[460px] rounded-full bg-[#6E3BF0]/12 blur-3xl" />
          <div className="absolute -bottom-24 left-0 h-[360px] w-[360px] rounded-full bg-white/50 blur-3xl" />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
            <div className="text-center lg:text-left">
              <span className="inline-flex rounded-full bg-[#6E3BF0]/10 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-[#6E3BF0]">Výzva OP JAK č. 02_26_048</span>
              <h1 className="mt-5 text-[40px] leading-[1.0] tracking-[-0.035em] text-[#0F1B6B] sm:text-[52px] md:text-[60px]" style={{ fontFamily: COOPER }}>
                Výzva Poradím se s AI
                <br />
                <span className="text-[#6E3BF0]">pro vaši školu</span>
              </h1>
              <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed md:text-[19px] lg:mx-0 text-[#0F1B6B]/75">
                <T>Výzva MŠMT podpoří školy, které chtějí AI ve výuce používat bezpečně a zodpovědně, tak aby žákům opravdu pomáhala. Z projektu lze zaplatit vzdělávání učitelů i licence aplikací s AI. S přípravou vám rádi pomůžeme.</T>
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
                <PrimaryCta className="px-6 py-3.5" />
                <a href="#vyzva" className="inline-flex items-center justify-center rounded-xl bg-[#0F1B6B] px-5 py-3 text-[15px] font-bold text-white transition hover:bg-[#1a2a8a]">
                  Co výzva vyžaduje
                </a>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[#0F1B6B]/12 pt-6 text-left md:grid-cols-4 lg:grid-cols-2">
                {[
                  ['300 mil. Kč', 'celková alokace výzvy'],
                  ['2–15 mil. Kč', 'rozpočet projektu, aspoň 5 spolupracujících škol'],
                  ['12–36 měsíců', 'délka projektu'],
                  ['30. 12. 2026', 'podání žádosti do 14:00'],
                ].map(([value, text]) => (
                  <div key={value}>
                    <p className="text-[20px] font-bold leading-none text-[#0F1B6B] md:text-[22px]">{value}</p>
                    <p className="mt-1 text-[12px] leading-snug text-[#0F1B6B]/55">{text}</p>
                  </div>
                ))}
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section id="vyzva" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-[820px]">
            <SectionTitle eyebrow="Výzva v kostce" title="Co je potřeba splnit" />
            <div className="mt-8 grid gap-3">
              {[
                'Žadatel existuje aspoň 2 roky a v roce 2025 sám pravidelně vzdělával žáky nebo pedagogy v práci s AI. Žadatelem nemusí být škola.',
                'Projekt má aspoň 5 spolupracujících škol nejméně dvou druhů (MŠ, ZŠ, SŠ). Každá škola smí být jen v jednom projektu.',
                'V každé škole se zapojí vedení a aspoň polovina pedagogů. Každý absolvuje 16 × 45 minut společného (ne jen online) a 10 × 45 minut individuálního vzdělávání.',
                'Hlavní část aktivit vede žadatel sám, dodavatel může jen pomáhat. V týmu je povinně bezpečnostní expert.',
                'Škola jako žadatel hradí nejméně 5 % nákladů projektu, zapojené školy nic. Je-li žadatel zřízený obcí nebo krajem, potřebuje souhlas zřizovatele.',
              ].map((item) => (
                <div key={item} className="flex gap-3 text-[16px] leading-relaxed text-[#001161]/75">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[#6E3BF0]" />
                  <T>{item}</T>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="ukazky" className="scroll-mt-24 mx-3 mt-3 rounded-[36px] md:mx-6 bg-[#E0E5F8] px-4 py-16 sm:px-6 md:px-10 md:pb-20">
          <div className="mx-auto max-w-[1200px]">
            <SectionTitle
              align="center"
              eyebrow="Ukázky z aplikace"
              title="Takhle s AI pracují učitelé ve Vividbooks"
              body={<T>AI u nás nenahrazuje učitele, ale šetří mu práci. Pracuje nad ověřenou knihovnou, kterou používá přes 700 škol, a každý výstup má pod kontrolou učitel.</T>}
            />
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {showcase.map((item) => (
                <figure key={item.title} className="overflow-hidden rounded-[26px] bg-white shadow-sm">
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#dfe4f7]">
                    <img src={item.src} alt={item.title} loading="lazy" className={`h-full w-full object-cover ${item.pos ?? 'object-top'}`} />
                    {item.overlay ? (
                      <img src={item.overlay} alt="Tištěné pracovní sešity Vividbooks" loading="lazy" className="absolute -bottom-3 left-3 w-[40%] drop-shadow-[0_12px_20px_rgba(0,17,97,0.3)]" />
                    ) : null}
                  </div>
                  <figcaption className="p-5">
                    <p className="text-[18px] font-bold text-[#001161]">{item.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#001161]/60">
                      <T>{item.body}</T>
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="mt-8 rounded-[28px] bg-[#0F1B6B] p-6 text-white md:p-8">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#FFDD00]">Bezpečně a zodpovědně</p>
              <div className="mt-5 grid gap-6 md:grid-cols-3">
                {[
                  ['Učitel má poslední slovo', 'AI navrhuje, učitel rozhoduje. Nic se k žákům nedostane bez jeho kontroly.'],
                  ['Ověřený obsah', 'AI vychází z materiálů s doložkou MŠMT, ne z náhodných zdrojů na internetu.'],
                  ['Žáci v bezpečí', 'Žáci nevidí správné odpovědi a pracují jen s tím, co jim učitel zadá.'],
                ].map(([title, body]) => (
                  <div key={title} className="flex gap-3">
                    <Check className="mt-1 h-5 w-5 shrink-0 text-[#FFDD00]" />
                    <div>
                      <p className="text-[16px] font-bold">{title}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-white/70">
                        <T>{body}</T>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mx-auto mt-8 max-w-[820px] text-center text-[17px] leading-relaxed text-[#0F1B6B]/75 md:text-[18px]">
              <T>S Vividbooks dnes pracuje přes 700 škol. Učební materiály tvoříme už 7 let, mají doložky MŠMT a rozvíjejí kompetence podle nového RVP včetně badatelské výuky. AI je u nás nadstavbou nad tímhle ověřeným obsahem.</T>
            </p>
          </div>
        </section>

        <section id="aktivity" className="scroll-mt-24 mx-3 mt-3 rounded-[36px] md:mx-6 bg-white px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-[1200px]">
            <SectionTitle
              align="center"
              eyebrow="Co dodáme"
              title="Aktivity výzvy a co k nim máme"
              body={<T>Aktivity vede vaše škola, my je podpoříme.</T>}
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {activities.map((a) => (
                <article key={a.code} className="rounded-[22px] bg-[#E0E5F8] p-5">
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#6E3BF0]">{a.code}</p>
                  <h3 className="mt-1 text-[17px] font-bold leading-snug text-[#001161]">{a.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#001161]/62">
                    <T>{a.ours}</T>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cenik" className="scroll-mt-24 mx-3 mt-3 rounded-[36px] md:mx-6 bg-[#F6E2AB] px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <SectionTitle
              align="center"
              eyebrow="Ceník"
              title="Jednoduše: licence na rok, AI v ceně"
              body={<T>Neplatíte za každý dotaz ani za tokeny. Vše, co AI v aplikaci spotřebuje, je zahrnuté v roční licenci. Ceny jsou včetně DPH.</T>}
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {plans.map((plan, i) => (
                <article
                  key={plan.name}
                  className={`flex flex-col rounded-[28px] p-7 md:p-8 ${i === 1 ? 'bg-[#001161] text-white shadow-[0_24px_70px_rgba(0,17,97,0.18)]' : 'border border-[#001161]/8 bg-white text-[#001161]'}`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-[30px] leading-tight" style={{ fontFamily: COOPER }}>
                      {plan.name}
                    </h3>
                    <span className={`text-[12px] font-bold uppercase tracking-[0.12em] ${i === 1 ? 'text-[#6E3BF0]' : 'text-[#6E3BF0]'}`}>{plan.tagline}</span>
                  </div>
                  <p className="mt-5 text-[40px] font-bold leading-none">
                    {czk(plan.price)}
                    <span className={`ml-2 text-[15px] font-bold ${i === 1 ? 'text-white/50' : 'text-[#001161]/45'}`}>/ rok</span>
                  </p>
                  <ul className="mt-6 grid flex-1 gap-3">
                    {plan.points.map((pt) => (
                      <li key={pt} className={`flex gap-3 text-[15px] leading-relaxed ${i === 1 ? 'text-white/75' : 'text-[#001161]/70'}`}>
                        <Check className="mt-1 h-4 w-4 shrink-0 text-[#6E3BF0]" />
                        <T>{pt}</T>
                      </li>
                    ))}
                  </ul>
                  <p className={`mt-6 border-t pt-4 text-[13px] font-bold ${i === 1 ? 'border-white/10 text-white/60' : 'border-[#001161]/8 text-[#001161]/55'}`}>
                    Do projektu jako: {plan.covers}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-[28px] border border-[#001161]/8 bg-white p-6 md:p-8">
              <h3 className="text-[22px] leading-tight text-[#001161]" style={{ fontFamily: COOPER }}>
                Vzdělávání k licencím
              </h3>
              <div className="mt-5 grid gap-5 md:grid-cols-3">
                {trainings.map((t) => (
                  <div key={t.name} className="rounded-2xl bg-[#f5f7fd] p-5">
                    <p className="text-[15px] font-bold text-[#001161]">{t.name}</p>
                    <p className="mt-2 text-[24px] font-bold leading-none text-[#001161]">
                      {t.price}
                      {t.period ? <span className="ml-2 text-[13px] font-bold text-[#001161]/45">{t.period}</span> : null}
                    </p>
                    <p className="mt-3 text-[14px] leading-relaxed text-[#001161]/60">
                      <T>{t.body}</T>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[28px] bg-white p-6 md:p-8">
              <h3 className="text-[22px] leading-tight text-[#001161]" style={{ fontFamily: COOPER }}>
                Kolik z toho zaplatí škola ze svého
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#001161]/55">
                <T>Orientačně 5 % z ceny licence, pokud je žadatelem škola. Zapojené školy nehradí nic.</T>
              </p>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-[15px]">
                  <thead className="text-[12px] uppercase tracking-[0.1em] text-[#001161]/45">
                    <tr>
                      <th className="py-2 pr-4 font-bold">Délka projektu</th>
                      <th className="py-2 pr-4 font-bold">AI pro učitele</th>
                      <th className="py-2 font-bold">Učitelé i žáci</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((years) => {
                      const teachers = plans[0].price * years;
                      const both = (plans[0].price + plans[1].price) * years;
                      return (
                        <tr key={years} className="border-t border-[#001161]/8">
                          <td className="py-3 pr-4 font-bold text-[#001161]">{years === 1 ? '1 rok' : `${years} roky`}</td>
                          <td className="py-3 pr-4 text-[#001161]/70">
                            {czk(teachers)} · <span className="font-bold text-[#6E3BF0]">škola {czk(Math.round(teachers * 0.05))}</span>
                          </td>
                          <td className="py-3 text-[#001161]/70">
                            {czk(both)} · <span className="font-bold text-[#6E3BF0]">škola {czk(Math.round(both * 0.05))}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-8 text-center">
              <PrimaryCta className="px-6 py-3.5" label="Chci nabídku pro naši školu" />
            </div>
          </div>
        </section>

        <section id="otazky" className="scroll-mt-24 mx-3 mt-3 rounded-[36px] md:mx-6 bg-white px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-[820px]">
            <SectionTitle align="center" eyebrow="Otázky" title="Na co se školy ptají" />
            <div className="mt-8 border-t border-[#001161]/10">
              {faq.map((item) => (
                <FaqItem key={item.question} {...item} />
              ))}
            </div>
          </div>
        </section>

        <section id="konzultace" className="scroll-mt-24 mx-3 mt-3 rounded-[36px] md:mx-6 mb-3 bg-[#0F1B6B] px-4 py-20 sm:px-6 md:px-10 md:py-24">
          <div className="mx-auto grid max-w-[1100px] items-start gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="text-white">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-white/80">Konzultace zdarma</span>
              <h2 className="mt-5 text-[38px] leading-[1.02] tracking-[-0.02em] md:text-[52px]" style={{ fontFamily: COOPER }}>
                Zjistěte, co z výzvy může mít vaše škola
              </h2>
              <p className="mt-5 max-w-[440px] text-[17px] leading-relaxed text-white/60">
                <T>Vyplňte pár údajů a do dvou pracovních dnů se vám ozveme. Konzultace je nezávazná.</T>
              </p>
              <p className="mt-6 text-[14px] text-white/40">
                Nebo napište na{' '}
                <a href={`mailto:${CONTACT_EMAIL}?subject=Poradím%20se%20s%20AI`} className="underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>
            <LeadForm />
          </div>
        </section>
      </main>
    </div>
  );
}

export default PoradimSeSAiLandingPage;
