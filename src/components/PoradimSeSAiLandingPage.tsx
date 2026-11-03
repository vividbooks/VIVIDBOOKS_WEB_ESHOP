import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
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

function Badge({ children, tone = 'mint' }: { children: React.ReactNode; tone?: 'violet' | 'mint' | 'orange' }) {
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

function PrimaryCta({ className = '', label = 'Chci nezávaznou konzultaci' }: { className?: string; label?: string }) {
  return (
    <a
      href="#konzultace"
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#03CA90] px-5 py-3 text-[15px] font-bold text-white shadow-sm transition hover:scale-[1.03] hover:bg-[#02a374] active:scale-[0.98] ${className}`}
      style={{ fontFamily: FF }}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

/** Aktivity výzvy (PpŽP – specifická část) a co k nim dodá Vividbooks. */
const activities = [
  {
    code: 'Aktivita 2',
    mandatory: true,
    title: 'Vnitřní pravidla pro bezpečné využívání AI',
    ours: 'Vzor školních pravidel pro AI, který s bezpečnostním expertem projektu upravíte na míru, a podklady k ochraně dat žáků.',
    output: 'Schválená školní pravidla pro AI',
  },
  {
    code: 'Aktivita 3',
    title: 'Přípravy na výuku s využitím AI',
    ours: 'Vividbooks AI připraví z tématu, fotky učebnice, PDF nebo webu hotové interaktivní aktivity. Navazují na knihovnu materiálů, kterou škola zná.',
    output: 'Přípravy hodin s AI a jejich reflexe',
  },
  {
    code: 'Aktivita 4',
    title: 'AI a zpětná vazba při sledování pokroku žáka',
    ours: 'Na 2. stupni testy ve vividboardu, které se opravují samy, a přehled, které otázky dělaly žákům největší potíže.',
    output: 'Popis hodnocení s AI a ukázky z výuky',
  },
  {
    code: 'Aktivita 7',
    title: 'Vzdělávání a seberozvoj pedagogů s AI',
    ours: 'Workshopy pro sborovnu a individuální konzultace, které můžete započítat do povinného vzdělávání pedagogů v projektu.',
    output: 'Reflexe práce s AI za každého pedagoga',
  },
  {
    code: 'Aktivita 8',
    title: 'AI ambasador',
    ours: 'Průvodce pro učitele, který bude AI ve škole rozvíjet: konzultace, podklady pro kolegy a přímá linka na náš tým.',
    output: 'Report o činnosti AI ambasadora',
  },
];

const steps = [
  {
    title: 'Ozvete se nám',
    body: 'Na krátkém hovoru zjistíme, kolik máte pedagogů, s čím už AI zkoušíte a kam chcete školu posunout. Konzultace je zdarma.',
  },
  {
    title: 'Pošleme orientační nabídku',
    body: 'Napíšeme, které části projektu můžeme dodat a za kolik. Poslouží vám jako podklad pro průzkum trhu. Výběr dodavatele je vždy na vás.',
  },
  {
    title: 'Dodáme, co si vyberete',
    body: 'Po schválení a výběru dodavatele dodáme licence aplikace, workshopy a podporu AI ambasadora. Projekt vede a věcně realizuje vaše škola.',
  },
];

const faq = [
  {
    question: 'Kdo může o podporu z výzvy Poradím se s AI žádat?',
    answer:
      'Mateřské, základní, střední a vyšší odborné školy, vysoké školy, zařízení pro další vzdělávání pedagogů, paměťové instituce, neziskové organizace a vybrané právnické osoby. Žadatel musí existovat aspoň dva roky a doložit, že se v roce 2025 věnoval AI ve vzdělávání.',
  },
  {
    question: 'Do kdy je potřeba podat žádost?',
    answer: 'Žádosti se podávají v aplikaci IS KP21+ do 30. 12. 2026 do 14:00. Projekt pak může trvat 12 až 36 měsíců.',
  },
  {
    question: 'Jak doložíme, že jsme se AI věnovali už v roce 2025?',
    answer:
      'Musí jít o pravidelnou nebo opakovanou činnost, ne jednorázovou akci, a čestné prohlášení nestačí. Doložit ji můžete pozvánkami, sylaby, prezenčními listinami nebo smlouvami. Pokud to vaše škola nesplní, může být žadatelem jiná ze spolupracujících škol.',
  },
  {
    question: 'Musíme už používat Vividbooks?',
    answer: 'Ne. Pokud nás už znáte, navážeme na materiály, které učitelé používají. Pokud ne, aplikaci si před rozhodnutím můžete zdarma vyzkoušet.',
  },
  {
    question: 'Musíme si sami najít partnerské školy?',
    answer:
      'Projekt potřebuje aspoň pět spolupracujících škol aspoň dvou druhů, například ZŠ a MŠ. Každá škola může být jen v jednom projektu, proto si partnery ověřte dřív, než je uvedete v žádosti. Pokud je teprve hledáte, rádi poradíme.',
  },
  {
    question: 'Kolik nás to bude stát?',
    answer:
      'Je-li žadatelem škola, hradí ze svého nejméně 5 % způsobilých výdajů. Záloha je až 50 % u projektu do 5 mil. Kč, nad tuto částku nejvýš 30 %. Licence aplikace s AI jsou způsobilé jen za dobu projektu. Pokud ji chcete používat i potom, platí se běžná cena.',
  },
  {
    question: 'Musíme dodavatele vybírat ve výběrovém řízení?',
    answer:
      'Řídí se to pravidly pro zakázky v projektech OP JAK. Nad 50 000 Kč je povinný průzkum trhu, nad 750 000 Kč bez DPH výběrové řízení, a části jedné zakázky se nesmí dělit. Náš podklad berte jako orientační nabídku do průzkumu trhu, ne jako hotový rozpočet.',
  },
  {
    question: 'Kdy se dozvíme výsledek?',
    answer: 'Výzva je kolová, hodnotit se začne po uzávěrce 30. 12. 2026. Hodnocení podle MŠMT potrvá nejméně šest měsíců.',
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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#03CA90]/15 text-[#03a978]">
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
    'w-full rounded-xl border border-[#001161]/12 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none transition focus:border-[#03CA90] focus:ring-2 focus:ring-[#03CA90]/20';
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
          <span className={label}>IČO školy</span>
          <input className={input} value={form.ico} onChange={set('ico')} inputMode="numeric" />
        </label>
        <label>
          <span className={label}>Vaše role</span>
          <input className={input} value={form.role} onChange={set('role')} placeholder="ředitel/ka, učitel/ka…" />
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
        <label className="sm:col-span-2">
          <span className={label}>Co by vám pomohlo? (nepovinné)</span>
          <textarea rows={3} className={input} value={form.message} onChange={set('message')} />
        </label>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden />
      <label className="mt-4 flex items-start gap-3 text-[13px] leading-relaxed text-[#001161]/60">
        <input type="checkbox" required checked={form.gdpr} onChange={set('gdpr')} className="mt-1 h-4 w-4 accent-[#03CA90]" />
        <span>Souhlasím, aby mě Vividbooks kontaktoval kvůli konzultaci k výzvě. Údaje použijeme jen k tomu.</span>
      </label>
      {error ? <p className="mt-3 text-[14px] font-bold text-[#c0392b]">{error}</p> : null}
      <button
        type="submit"
        disabled={state === 'sending'}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#03CA90] px-6 py-4 text-[16px] font-bold text-white transition hover:bg-[#02a374] disabled:opacity-60"
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
              ['#aktivity', 'Co dodáme'],
              ['#postup', 'Jak to proběhne'],
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
        <section className="relative overflow-hidden bg-[#eefbf6] px-4 pb-16 pt-10 sm:px-6 md:px-10 md:pb-20 md:pt-14">
          <div className="absolute -right-28 -top-28 h-[420px] w-[420px] rounded-full bg-[#03CA90]/14 blur-3xl" />
          <div className="absolute -bottom-24 left-0 h-[360px] w-[360px] rounded-full bg-[#7C3AED]/10 blur-3xl" />
          <div className="relative mx-auto max-w-[1000px] text-center">
            <Badge>Výzva OP JAK č. 02_26_048</Badge>
            <h1 className="mt-5 text-[40px] leading-[1.0] tracking-[-0.035em] text-[#001161] sm:text-[54px] md:text-[66px]" style={{ fontFamily: COOPER }}>
              AI ve výuce nad materiály, které vaši učitelé znají
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-[17px] leading-relaxed text-[#001161]/68 md:text-[19px]">
              <T>Výzva Poradím se s AI podpoří školy, které chtějí AI používat smysluplně a bezpečně. Projekt vede vaše škola. My vám pomůžeme zorientovat se v podmínkách a do projektu dodáme licence aplikace s Vividbooks AI, workshopy pro sborovnu a podporu AI ambasadora.</T>
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <PrimaryCta className="px-6 py-3.5" />
              <a href="#aktivity" className="inline-flex items-center justify-center rounded-xl border border-[#001161]/12 bg-white/65 px-5 py-3 text-[15px] font-bold text-[#001161] transition hover:bg-white">
                Co od nás dostanete
              </a>
            </div>
            <div className="mx-auto mt-10 grid max-w-[820px] grid-cols-2 gap-4 border-t border-[#001161]/10 pt-6 text-left md:grid-cols-4">
              {[
                ['300 mil. Kč', 'celková alokace výzvy'],
                ['2–15 mil. Kč', 'rozpočet projektu pro 6 a více škol'],
                ['12–36 měsíců', 'délka projektu'],
                ['30. 12. 2026', 'podání žádosti do 14:00'],
              ].map(([value, text]) => (
                <div key={value}>
                  <p className="text-[22px] font-bold leading-none text-[#001161] md:text-[26px]">{value}</p>
                  <p className="mt-1 text-[12px] leading-snug text-[#001161]/50">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="vyzva" className="scroll-mt-24 px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <SectionTitle
                eyebrow="Výzva v kostce"
                title="O co ve výzvě jde"
                body={
                  <T>
                    Cílem je, aby školy používaly AI jako nástroj pro lepší výuku, ne jako hračku. Podporuje se vzdělávání učitelů, sdílení praxe mezi školami, bezpečná pravidla a práce s AI při přípravě, hodnocení i vedení školy.
                  </T>
                }
              />
              <div className="mt-8 grid gap-3">
                {[
                  'Žadatel existuje aspoň dva roky a v roce 2025 se pravidelně věnoval AI ve vzdělávání (dokládá se pozvánkami, sylaby, prezenčními listinami).',
                  'Projekt má aspoň pět dalších spolupracujících škol aspoň dvou druhů (třeba ZŠ a MŠ). Každá škola smí být jen v jednom projektu.',
                  'V každé škole se zapojí vedení a aspoň polovina pedagogů. Každý absolvuje 16 × 45 minut společného vzdělávání (ne jen online) a 10 × 45 minut individuálního.',
                  'Povinně se řeší řízení projektu a pravidla bezpečného využívání AI s bezpečnostním expertem v týmu projektu. Další aktivity si škola vybere.',
                  'S projektem musí souhlasit zřizovatel. U obce to často znamená zasedání rady, proto to neodkládejte.',
                  'Škola jako žadatel hradí nejméně 5 % způsobilých výdajů.',
                ].map((item) => (
                  <div key={item} className="flex gap-3 text-[15px] leading-relaxed text-[#001161]/70">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#03CA90]" />
                    <T>{item}</T>
                  </div>
                ))}
              </div>
            </div>
            <aside className="rounded-[30px] bg-[#001161] p-7 text-white shadow-[0_24px_80px_rgba(0,17,97,0.2)] md:p-9">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/40">Nejčastější zádrhel</p>
              <p className="mt-5 text-[26px] leading-snug" style={{ fontFamily: COOPER }}>
                Výzva chce doložit, že se škola AI ve výuce věnovala už v roce 2025.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-white/60">
                <T>Čestné prohlášení nestačí, počítají se pozvánky, sylaby, prezenční listiny nebo smlouvy. Na konzultaci spolu projdeme, co máte, a kdo z partnerských škol může být žadatelem.</T>
              </p>
              <div className="my-7 h-px bg-white/10" />
              <div className="grid gap-3 text-[14px] text-white/70">
                <div className="flex gap-3">
                  <CalendarDays className="h-5 w-5 shrink-0 text-[#03CA90]" />
                  <span>Příjem žádostí od 23. 6. do 30. 12. 2026, 14:00</span>
                </div>
                <div className="flex gap-3">
                  <ClipboardCheck className="h-5 w-5 shrink-0 text-[#03CA90]" />
                  <span>Žádost se podává v IS KP21+ (iskp21.mssf.cz)</span>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section id="aktivity" className="scroll-mt-24 bg-[#f5f7fd] px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-[1200px]">
            <SectionTitle
              align="center"
              eyebrow="Co dodáme"
              title="Aktivity výzvy a co k nim máme"
              body={<T>Aktivity vede a realizuje vaše škola, výzva nedovoluje svěřit je celé dodavateli. Tady je, čím je můžeme podpořit.</T>}
            />
            <div className="mt-10 grid gap-4">
              {activities.map((a) => (
                <article key={a.code} className="grid gap-4 rounded-[24px] border border-[#001161]/8 bg-white p-6 md:grid-cols-[0.9fr_1.3fr_0.8fr] md:items-center">
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#03a978]">
                      {a.code}
                      {a.mandatory ? ' · povinná' : ''}
                    </p>
                    <h3 className="mt-1 text-[19px] font-bold leading-snug text-[#001161]">{a.title}</h3>
                  </div>
                  <p className="text-[15px] leading-relaxed text-[#001161]/66">
                    <T>{a.ours}</T>
                  </p>
                  <div className="rounded-2xl bg-[#eefbf6] px-4 py-3 text-[13px] font-bold leading-snug text-[#017d5b]">
                    Výstup školy: {a.output}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-[1200px]">
            <SectionTitle
              align="center"
              eyebrow="Proč Vividbooks"
              title="AI nad materiály, které vaši učitelé znají"
              body={<T>Vividbooks používá přes 600 základních škol. AI u nás nestojí vedle výuky, ale pracuje s knihovnou učebních materiálů s doložkou MŠMT.</T>}
            />
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                [Sparkles, 'Vividbooks AI', 'Z tématu, fotky učebnice, PDF nebo webu připraví hotové interaktivní aktivity. Učitel je jen upraví.'],
                [BookOpen, 'Knihovna a vividboard', 'Lekce, pracovní listy a testy, které si učitel zkopíruje a upraví. Na 2. stupni se testy ve vividboardu opravují samy.'],
                [GraduationCap, 'Workshopy pro sborovnu', 'Učíme na vaší vlastní výuce a materiálech, ne na teorii. Prezenčně ve škole i jako navazující konzultace.'],
              ].map(([Icon, title, body]) => {
                const TypedIcon = Icon as typeof Sparkles;
                return (
                  <article key={String(title)} className="rounded-[24px] border border-[#001161]/8 bg-white p-6 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eefbf6] text-[#03a978]">
                      <TypedIcon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-[19px] font-bold text-[#001161]">{String(title)}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#001161]/62">
                      <T>{String(body)}</T>
                    </p>
                  </article>
                );
              })}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="flex gap-4 rounded-[24px] border border-[#03CA90]/20 bg-[#03CA90]/8 p-6">
                <ShieldCheck className="h-6 w-6 shrink-0 text-[#03a978]" />
                <p className="text-[15px] leading-relaxed text-[#001161]/70">
                  <T>Bezpečně: žáci v aplikaci nevidí správné odpovědi a učitel má pod kontrolou, co jim sdílí. Ke školním pravidlům pro AI vám dáme vzor, který s bezpečnostním expertem projektu upravíte.</T>
                </p>
              </div>
              <div className="flex gap-4 rounded-[24px] border border-[#7C3AED]/15 bg-[#7C3AED]/6 p-6">
                <Users className="h-6 w-6 shrink-0 text-[#7C3AED]" />
                <p className="text-[15px] leading-relaxed text-[#001161]/70">
                  <T>Hledáte partnerské školy? Poradíme, jak je najít. Každou školu přitom doporučíme jen do jednoho projektu, protože dvojí zařazení žádost zastaví.</T>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="postup" className="scroll-mt-24 bg-[#f5f7fd] px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-[1200px]">
            <SectionTitle
              align="center"
              eyebrow="Postup"
              title="Jak to proběhne"
              body={<T>Nemusíte mít hotový projekt ani vědět, které aktivity vybrat. Do uzávěrky zbývá pár týdnů, proto začněte co nejdřív.</T>}
            />
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => (
                <article key={step.title} className="relative rounded-[26px] border border-[#001161]/8 bg-white p-6 shadow-sm">
                  <p className="text-[48px] font-bold leading-none text-[#03CA90]/20">{String(index + 1).padStart(2, '0')}</p>
                  <h3 className="mt-5 text-[24px] leading-tight text-[#001161]" style={{ fontFamily: COOPER }}>
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#001161]/62">
                    <T>{step.body}</T>
                  </p>
                  {index < steps.length - 1 ? <ArrowRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-[#03CA90] md:block" /> : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="otazky" className="scroll-mt-24 px-4 py-16 sm:px-6 md:px-10 md:py-20">
          <div className="mx-auto max-w-[820px]">
            <SectionTitle align="center" eyebrow="Otázky" title="Na co se školy ptají" />
            <div className="mt-8 border-t border-[#001161]/10">
              {faq.map((item) => (
                <FaqItem key={item.question} {...item} />
              ))}
            </div>
          </div>
        </section>

        <section id="konzultace" className="scroll-mt-24 bg-[#001161] px-4 py-20 sm:px-6 md:px-10 md:py-24">
          <div className="mx-auto grid max-w-[1100px] items-start gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="text-white">
              <Badge>Konzultace zdarma</Badge>
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
