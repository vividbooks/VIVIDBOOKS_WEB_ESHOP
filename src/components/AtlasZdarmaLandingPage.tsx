/**
 * Kampaň „Atlas zeměpisu zdarma“ (listopad 2026) — microsite /atlas-zdarma.
 *
 * Cíl: nasbírat kontakty na učitele zeměpisu (v Kabinetu zeměpis dosud nikdo nemá vyplněný).
 *   1. Učitel dostane Vivid Atlas zdarma a k tomu měsíc celé aplikace Vividbooks (trial z webu).
 *   2. Kdo chce, přihlásí se do pilotování nové řady Vividbooks Zeměpis.
 *   3. Kolegy zeměpisáře pozve e-mailem (server `pilotInvites.ts`, mode 'atlas') nebo sdílí odkaz
 *      s kódem `?pozvanka=` — kód jde do poznámky přihlášky, takže v Kabinetu je vidět, kdo koho přivedl.
 *
 * Přihláška jde stejně jako dřív pilotáž matematiky přes `kabinet-trial/request`. Zeměpis Kabinet jako
 * předmět trialu nezná → posíláme `Other-<stupeň>` a předmět píšeme do poznámky (ATLAS_NOTE).
 * Škola, která už Vividbooks má, dostane od Kabinetu `rejected` (HAS_ACTIVE_*), ale přihláška se zapíše
 * i s poznámkou — kontakt tedy máme vždy.
 */
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, Check, CheckCircle2, ChevronDown, Copy, Loader2 } from 'lucide-react';
import { SEOHead, faqJsonLd } from './SEOHead';
import { AtlasGlobe } from './AtlasGlobe';
import logoPaths from '../imports/svg-fupfguvmdt';
import { formatTypography } from '../utils/formatTypography';
import { isValidEmailFormat, EMAIL_FORMAT_HINT_CS } from '../utils/emailValidation';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import {
  ColleaguesField,
  DEFAULT_INVITE_MESSAGE,
  InviteResultList,
  MessageField,
  lookupSchool,
  registerReferral,
  sendInvites,
  type InviteResult,
  type SchoolLookup,
} from './atlasFormParts';

const FF = "'Fenomen Sans', sans-serif";
const COOPER = "'Cooper Light', serif";
const BLUE = '#001161';
const NIGHT = '#0F1B6B';
const SCREEN = '#1e2533'; // pozadí aplikace Atlas
const VIVIDBOOKS_LOGO_VIEWBOX = '0 0 1786.62 869.93';
const PAGE_PATH = '/atlas-zdarma';
const ATLAS_APP_URL = 'https://nove.vividbooks.com/atlas';
const ATLAS_NOTE = 'Atlas zeměpisu zdarma 2026/27 (Atlas + měsíc aplikace, předmět zeměpis)';
const REF_STORAGE_KEY = 'vb_atlas_pozvanka';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const KABINET_TRIAL_FN = `https://${projectId}.supabase.co/functions/v1/kabinet-trial`;

const POSITIONS = ['Učitel/ka zeměpisu', 'Učitel/ka vlastivědy (1. stupeň)', 'Ředitel/ka nebo zástupce', 'Metodik/čka', 'Jiné'];

const IMG = (name: string) => `/kampane/atlas/${name}.webp`;

function T({ children }: { children: string }) {
  return <>{formatTypography(children)}</>;
}

function VividLogo({ color = BLUE }: { color?: string }) {
  return (
    <Link to="/" className="inline-flex shrink-0 items-center" aria-label="Vividbooks">
      <svg viewBox={VIVIDBOOKS_LOGO_VIEWBOX} fill="none" className="h-auto w-[88px]">
        {[
          logoPaths.p299c6b00,
          logoPaths.p3cc4870,
          logoPaths.p98d9300,
          logoPaths.pf524b00,
          logoPaths.p26e2d80,
          logoPaths.p15998cf0,
          logoPaths.p1bd3b900,
          logoPaths.p19a24c00,
          logoPaths.p34d64300,
          logoPaths.p396dedf0,
        ].map((d) => (
          <path key={d} d={d} fill={color} />
        ))}
      </svg>
    </Link>
  );
}

function SectionTitle({ eyebrow, title, body, align = 'left', dark = false }: { eyebrow?: string; title: string; body?: string; align?: 'left' | 'center'; dark?: boolean }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-[760px] text-center' : 'max-w-[700px]'}>
      {eyebrow ? (
        <p className={`mb-2 text-[12px] font-bold uppercase tracking-[0.14em] ${dark ? 'text-white/45' : 'text-[#001161]/40'}`} style={{ fontFamily: FF }}>
          <T>{eyebrow}</T>
        </p>
      ) : null}
      <h2 className={`text-[30px] leading-[1.08] tracking-[-0.02em] md:text-[42px] ${dark ? 'text-white' : 'text-[#001161]'}`} style={{ fontFamily: COOPER }}>
        <T>{title}</T>
      </h2>
      {body ? (
        <p
          className={`mt-4 text-[16px] leading-relaxed md:text-[17px] ${dark ? 'text-white/70' : 'text-[#001161]/64'} ${align === 'center' ? 'mx-auto max-w-[640px]' : ''}`}
          style={{ fontFamily: FF }}
        >
          <T>{body}</T>
        </p>
      ) : null}
    </div>
  );
}

function PrimaryCta({ label = 'Chci Atlas zdarma', href = '#prihlaska', className = '' }: { label?: string; href?: string; className?: string }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#6E3BF0] px-6 py-3.5 text-[16px] font-bold text-white shadow-sm transition hover:scale-[1.03] hover:bg-[#5a2fd6] active:scale-[0.98] ${className}`}
      style={{ fontFamily: FF }}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

/* ─────────────────────────── hero s glóbem ─────────────────────────── */

function Hero() {
  return (
    <section className="relative mx-3 mt-3 overflow-hidden rounded-[36px] px-5 pb-14 pt-10 text-white sm:px-8 md:mx-6 md:px-12 md:pb-16 md:pt-12" style={{ background: SCREEN }}>
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
        <div className="text-center lg:text-left">
          <span className="inline-flex rounded-full bg-[#32f4ab]/15 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-[#32f4ab]" style={{ fontFamily: FF }}>
            Vivid Atlas zdarma pro učitele zeměpisu
          </span>
          <h1 className="mt-5 text-[40px] leading-[1.0] tracking-[-0.035em] text-white sm:text-[52px] md:text-[60px]" style={{ fontFamily: COOPER }}>
            Svět nejen na mapě,
            <br />
            <span className="text-[#a78bfa]">ale v datech a souvislostech</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-white/75 md:text-[19px] lg:mx-0" style={{ fontFamily: FF }}>
            <T>Vivid Atlas spojuje glóbus, klima, obyvatelstvo, ekonomiku i historii s daty, která žáci sami porovnají. Dostanete ho zdarma a k tomu měsíc celé aplikace Vividbooks.</T>
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
            <PrimaryCta />
            <a href="#kolegove" className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-[15px] font-bold text-[#1e2533] transition hover:bg-white/85" style={{ fontFamily: FF }}>
              Poslat kolegovi
            </a>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/12 pt-6 text-left md:grid-cols-4 lg:grid-cols-2" style={{ fontFamily: FF }}>
            {[
              ['60+ témat', 'klima, obyvatelstvo, ekonomika, příroda, historie'],
              ['200 států', 'graf jedním klikem a srovnání v čase'],
              ['od roku 1960', 'vývoj přehrajete jako film'],
              ['zdarma', 'Atlas pro vás, k tomu měsíc celé aplikace'],
            ].map(([value, text]) => (
              <div key={value}>
                <p className="text-[20px] font-bold leading-none text-white md:text-[22px]">{value}</p>
                <p className="mt-1 text-[12px] leading-snug text-white/55">
                  <T>{text}</T>
                </p>
              </div>
            ))}
          </div>
        </div>
        <AtlasGlobe />
      </div>
    </section>
  );
}

/** Smyčka ze skutečného Atlasu (natočeno skriptem vividbooks-video/scripts/atlas/take-web-clip.mjs). */
function AtlasClip() {
  const ref = React.useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => undefined) : v.pause()), { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <div className="overflow-hidden rounded-[26px] border-[6px] border-white bg-[#1e2533] shadow-[0_30px_80px_-24px_rgba(0,17,97,0.35)]">
      <video
        ref={ref}
        src="/kampane/atlas/porodnost.mp4"
        poster="/kampane/atlas/porodnost.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Ukázka z Vivid Atlasu: porodnost ve světě, vývoj v čase a srovnání s HDP na obyvatele"
        className="block aspect-[16/9] w-full"
      />
    </div>
  );
}

function ShowcaseSection() {
  return (
    <section id="ukazky" className="scroll-mt-20 bg-white px-4 pb-6 pt-16 sm:px-6 md:px-12 md:pt-20">
      <div className="mx-auto max-w-[1100px]">
        <SectionTitle
          align="center"
          eyebrow="Podívejte se do Atlasu"
          title="Proč se v Africe rodí víc dětí?"
          body="Žáci vyberou porodnost, pustí vývoj od roku 1960 a přidají k tomu HDP na obyvatele. Souvislost uvidí sami, posunem po časové ose."
        />
        <div className="mt-10">
          <AtlasClip />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2" style={{ fontFamily: FF }}>
          {['1. Vyberou téma Porodnost', '2. Pustí vývoj v čase', '3. Přidají HDP na obyvatele', '4. Posouvají časovou osu'].map((t) => (
            <span key={t} className="rounded-full bg-[#E0E5F8] px-4 py-2 text-[14px] font-bold text-[#0F1B6B]">
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── co v Atlasu je ─────────────────────────── */

const FEATURES = [
  {
    img: 'teploty',
    title: 'Počasí a podnebí',
    body: 'Teploty, srážky a amplituda po měsících. Evropa po regionech, klimadiagram jedním klikem a srovnání až pěti států v grafu.',
  },
  {
    img: 'zalidneni',
    title: 'Obyvatelstvo a ekonomika',
    body: 'Hustota zalidnění, porodnost, délka života, migrace, HDP, průmysl a služby. Vývoj od roku 1960 přehrajete jako film.',
  },
  {
    img: 'desky',
    title: 'Fyzická geografie',
    body: 'Litosférické desky, biomy, půdní typy, úmoří a mořské proudy. Na glóbu i na ploché mapě, s podkladem obecným, satelitním, reliéfem i slepým.',
  },
  {
    img: 'slavkov',
    title: 'Historie a tažení',
    body: 'Hranice států od pravěku po dnešek a bitvy krok po kroku: Slavkov, Bílá hora, Stalingrad. Hodí se i kolegům z dějepisu.',
  },
  {
    img: 'ukoly',
    title: 'Úkoly pro třídu',
    body: 'Seřaď, najdi na mapě, hledej souvislost: sousedé Česka v číslech, Visegrádská čtyřka, porodnost a bohatství. Procvičit hned, nebo zadat ve výuce.',
  },
  {
    img: 'globus',
    title: 'Glóbus, Evropa, Česko',
    body: 'Jedním klikem ze světa na Evropu a do Česka. V Česku až po okresní města, řeky přibývají s přiblížením.',
  },
];

function FeaturesSection() {
  return (
    <section id="co-umi" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 md:px-12 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle eyebrow="Co v Atlasu najdete" title="Atlas, který odpoví na otázky žáků" body="Přes šedesát témat s daty, legendou a vysvětlením, jak data číst. Žák klikne na stát a hned vidí graf." />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="overflow-hidden rounded-[22px] bg-[#f5f7fb] ring-1 ring-[#001161]/6">
              <div className="aspect-[16/10] overflow-hidden bg-[#151B2E]" style={{ background: SCREEN }}>
                <img src={IMG(f.img)} alt={f.title} loading="lazy" className="h-full w-full object-cover object-left-top" />
              </div>
              <div className="p-6">
                <h3 className="text-[20px] font-bold text-[#001161]" style={{ fontFamily: FF }}>
                  <T>{f.title}</T>
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#001161]/65" style={{ fontFamily: FF }}>
                  <T>{f.body}</T>
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── jak to funguje ─────────────────────────── */

const STEPS = [
  { n: '1', title: 'Vyplníte přihlášku', body: 'Minutu zabere. Stačí jméno, škola a školní e-mail.' },
  { n: '2', title: 'Atlas a měsíc aplikace hned', body: 'Kódy školy uvidíte hned po odeslání. Atlas je váš a celou aplikaci Vividbooks máte měsíc na zkoušku: učebnice, pracovní listy, testy a Vividboard.' },
  { n: '3', title: 'Pilotování Vividbooks Zeměpisu', body: 'Chystáme novou řadu Zeměpisu pro 6.–9. ročník. Kdo se přihlásí k pilotování, dostane lekce mezi prvními a jeho připomínky se do nich promítnou.' },
];

function StepsSection() {
  return (
    <section id="jak" className="scroll-mt-20 mx-3 rounded-[36px] bg-[#E0E5F8] px-4 py-16 sm:px-6 md:mx-6 md:px-12 md:py-20">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle eyebrow="Jak to funguje" title="Tři kroky, žádný závazek" align="center" />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-[22px] bg-white p-7 shadow-sm ring-1 ring-[#001161]/6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#6E3BF0] text-[18px] font-bold text-white" style={{ fontFamily: FF }}>
                {s.n}
              </span>
              <h3 className="mt-5 text-[20px] font-bold text-[#001161]" style={{ fontFamily: FF }}>
                <T>{s.title}</T>
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#001161]/65" style={{ fontFamily: FF }}>
                <T>{s.body}</T>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── přihláška ─────────────────────────── */

type SchoolResult = { name: string; ico: string; address?: string };

const INPUT =
  'w-full rounded-[14px] border border-[#001161]/15 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none transition placeholder:text-[#001161]/40 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15';

function SchoolField({ schoolName, ico, onChange }: { schoolName: string; ico: string; onChange: (name: string, ico: string) => void }) {
  const [results, setResults] = useState<SchoolResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = React.useRef<number | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);

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
        const res = await fetch(`${SERVER}/school-search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
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

type Outcome = { kind: 'codes'; teacherCode: string; studentCode: string } | { kind: 'manual'; message: string } | { kind: 'has_school'; schoolName: string };
type TrialResponse = { ok?: boolean; status?: string; code?: string; message?: string; teacherCode?: string; studentCode?: string };

function outcomeFromTrial(data: TrialResponse): Outcome {
  if (data.ok && (data.status === 'created' || data.status === 'extended') && data.teacherCode && data.studentCode) {
    return { kind: 'codes', teacherCode: data.teacherCode, studentCode: data.studentCode };
  }
  if (data.ok && (data.status === 'created' || data.status === 'extended')) {
    return { kind: 'manual', message: 'Přístupové kódy vám pošleme e-mailem.' };
  }
  if (data.code === 'HAS_ACTIVE_SUBSCRIPTION' || data.code === 'HAS_ACTIVE_TRIAL') {
    return { kind: 'manual', message: 'Vaše škola už Vividbooks má. Přihlaste se svým účtem a Atlas najdete hned. Kdyby něco nešlo, ozveme se.' };
  }
  return { kind: 'manual', message: 'Vaše škola u nás nedávno zkoušela přístup. Ozveme se vám do dvou pracovních dnů a Atlas vám zpřístupníme.' };
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
        Učím na
      </legend>
      <div className="flex flex-wrap gap-2">
        {[
          [2, '2. stupni (zeměpis)'],
          [1, '1. stupni (vlastivěda)'],
        ].map(([n, label]) => {
          const on = stages.includes(n as number);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onToggle(n as number)}
              aria-pressed={on}
              className={`rounded-xl border px-4 py-2.5 text-[14px] font-bold transition ${on ? 'border-[#7C3AED] bg-[#f3eeff] text-[#5B21B6]' : 'border-[#001161]/15 bg-white text-[#001161]/60'}`}
              style={{ fontFamily: FF }}
            >
              {label}
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

function PilotCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-1 flex cursor-pointer items-start gap-3 rounded-[14px] bg-[#EEF3FB] p-4" style={{ fontFamily: FF }}>
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[#7C3AED]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-[14px] leading-snug text-[#001161]">
        <strong>Chci pilotovat nový Vividbooks Zeměpis</strong>
        <span className="block text-[13px] text-[#001161]/55">Lekce pro 6.–9. ročník dostanete mezi prvními. Občas se zeptáme, jak to ve třídě šlo.</span>
      </span>
    </label>
  );
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-1 flex cursor-pointer items-start gap-3" style={{ fontFamily: FF }}>
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[#7C3AED]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-[13px] leading-snug text-[#001161]/65">
        Souhlasím se{' '}
        <a href="/kontakt" target="_blank" rel="noreferrer" className="underline">
          zpracováním osobních údajů
        </a>{' '}
        pro účely přístupu k Atlasu a pilotování. *
      </span>
    </label>
  );
}

function useReferralCode(): string {
  const [params] = useSearchParams();
  const fromUrl = (params.get('pozvanka') || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
  const [code, setCode] = useState(fromUrl);
  useEffect(() => {
    try {
      if (fromUrl) window.sessionStorage.setItem(REF_STORAGE_KEY, fromUrl);
      else setCode(window.sessionStorage.getItem(REF_STORAGE_KEY) || '');
    } catch {
      /* úložiště nemusí být dostupné */
    }
  }, [fromUrl]);
  return code;
}

function ShareLink({ email, name }: { email: string; name: string }) {
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    registerReferral(email, name)
      .then((code) => {
        if (alive) setLink(`${window.location.origin}${PAGE_PATH}${code ? `?pozvanka=${code}` : ''}`);
      })
      .catch(() => alive && setLink(`${window.location.origin}${PAGE_PATH}`));
    return () => {
      alive = false;
    };
  }, [email, name]);
  if (!link) return null;
  return (
    <div className="mx-auto mt-6 max-w-md text-left" style={{ fontFamily: FF }}>
      <p className="mb-2 text-[14px] font-bold text-[#001161]">Nebo pošlete odkaz do sborovny či skupiny učitelů</p>
      <div className="flex gap-2">
        <input readOnly value={link} className={`${INPUT} text-[13px]`} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => undefined);
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[14px] bg-[#001161] px-4 text-[14px] font-bold text-white hover:bg-[#001161]/85"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Hotovo' : 'Kopírovat'}
        </button>
      </div>
    </div>
  );
}

function AtlasForm() {
  const referral = useReferralCode();
  const [path, setPath] = useState<null | 'yes' | 'no'>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', position: '' });
  const [schoolName, setSchoolName] = useState('');
  const [ico, setIco] = useState('');
  const [stages, setStages] = useState<number[]>([2]);
  const [wantsPilot, setWantsPilot] = useState(true);
  const [gdpr, setGdpr] = useState(false);
  const [colleagues, setColleagues] = useState<string[]>([]);
  const [message, setMessage] = useState(DEFAULT_INVITE_MESSAGE);
  const [lookup, setLookup] = useState<SchoolLookup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [invites, setInvites] = useState<InviteResult[]>([]);
  const [inviteError, setInviteError] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleStage = (n: number) => setStages((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n].sort()));
  const go = (next: typeof path) => {
    setPath(next);
    setError('');
    if (next !== 'yes') setLookup(null);
  };

  const note = () =>
    [
      ATLAS_NOTE,
      form.position ? `pozice: ${form.position}` : '',
      `stupně: ${stages.join(' a ')}`,
      wantsPilot ? 'chce pilotovat Zeměpis' : 'pilotování zatím ne',
      colleagues.length ? `pozval kolegy: ${colleagues.length}` : '',
      referral ? `přišel na pozvánku ${referral}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

  const requestTrial = async (body: Record<string, unknown>): Promise<TrialResponse> => {
    const res = await fetch(`${KABINET_TRIAL_FN}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ ...body, subjects: stages.map((n) => `Other-${n}`), schoolStages: stages, newsletter: false, country: 'cz', note: note() }),
    });
    const data = (await res.json().catch(() => null)) as TrialResponse | null;
    if (!data) throw new Error(`Server neodpověděl (HTTP ${res.status}).`);
    if (data.code === 'INVALID') throw new Error(data.message || 'Vyplňte prosím všechny povinné údaje.');
    if (!(data.ok && (data.status === 'created' || data.status === 'extended')) && data.status !== 'rejected') {
      throw new Error(data.message || `Přihlášku se nepodařilo odeslat (HTTP ${res.status}).`);
    }
    return data;
  };

  const inviteColleagues = async () => {
    if (!colleagues.length) return;
    const r = await sendInvites({ mode: 'atlas', inviterEmail: form.email.trim(), inviterName: form.name.trim(), emails: colleagues, message });
    setInvites(r.results);
    setInviteError(r.error || '');
  };

  const failed = (err: unknown) =>
    setError(`${err instanceof Error ? err.message : 'Přihlášku se nepodařilo odeslat.'} Zkuste to prosím znovu, nebo napište na hello@vividbooks.com.`);

  const validCommon = (): boolean => {
    if (!form.name.trim()) return setError('Vyplňte prosím jméno a příjmení.'), false;
    if (stages.length === 0) return setError('Vyberte prosím, na kterém stupni učíte.'), false;
    if (!gdpr) return setError('Potřebujeme váš souhlas se zpracováním osobních údajů.'), false;
    return true;
  };

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

  /* Škola Vividbooks má: zapíšeme kontakt (Kabinet žádost odmítne, ale uloží s poznámkou) a pozveme kolegy. */
  const attach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validCommon()) return;
    setSubmitting(true);
    setError('');
    try {
      await requestTrial({ fullName: form.name.trim(), email: form.email.trim(), schoolName: lookup?.schoolName || '' });
      await inviteColleagues();
      setOutcome({ kind: 'has_school', schoolName: lookup?.schoolName || 'Vaše škola' });
    } catch (err) {
      failed(err);
    } finally {
      setSubmitting(false);
    }
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Vyplňte prosím jméno a příjmení.');
    if (!schoolName.trim() || ico.length < 6) return setError('Vyberte prosím školu a doplňte IČO.');
    if (!isValidEmailFormat(form.email.trim())) return setError(EMAIL_FORMAT_HINT_CS);
    if (!form.position) return setError('Vyberte prosím, co učíte.');
    if (!validCommon()) return;
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
      });
      await inviteColleagues();
      setOutcome(outcomeFromTrial(data));
    } catch (err) {
      failed(err);
    } finally {
      setSubmitting(false);
    }
  };

  const card = 'rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-[#001161]/8 md:p-8';
  const inviteFields = (
    <div className="mt-1 grid gap-3 border-t border-[#001161]/8 pt-4">
      <ColleaguesField label="Pošlete Atlas kolegům zeměpisářům" optional emails={colleagues} onChange={setColleagues} hint="Nejvýš 15 adres. Dostanou odkaz na Atlas vaším jménem." />
      {colleagues.length ? <MessageField value={message} onChange={setMessage} /> : null}
    </div>
  );

  if (outcome) {
    const anySent = invites.some((r) => r.status === 'sent');
    return (
      <div className="rounded-[24px] border border-green-200 bg-[#F0FDF4] p-7 text-center md:p-9">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
        <h3 className="text-[26px] font-bold text-[#001161]" style={{ fontFamily: FF }}>
          Atlas je váš
        </h3>
        {outcome.kind === 'codes' ? (
          <>
            <p className="mx-auto mt-2 max-w-[440px] text-[15px] leading-relaxed text-[#001161]/70" style={{ fontFamily: FF }}>
              <T>Založte si účet s kódem pro učitele. Atlas a celou aplikaci Vividbooks máte hned, kódy jsme poslali i e-mailem.</T>
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
        ) : outcome.kind === 'has_school' ? (
          <p className="mx-auto mt-2 max-w-[440px] text-[15px] leading-relaxed text-[#001161]/70" style={{ fontFamily: FF }}>
            <T>{`${outcome.schoolName} už Vividbooks má, takže Atlas najdete hned po přihlášení svým účtem.${wantsPilot ? ' K pilotování Zeměpisu vás zapíšeme a ozveme se.' : ''}`}</T>
          </p>
        ) : (
          <p className="mx-auto mt-2 max-w-[440px] text-[15px] leading-relaxed text-[#001161]/70" style={{ fontFamily: FF }}>
            <T>{`Přihlášku máme. ${outcome.message}`}</T>
          </p>
        )}
        <a
          href={ATLAS_APP_URL}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F1B6B] px-6 py-3 text-[15px] font-bold text-white transition hover:bg-[#1a2a8a]"
          style={{ fontFamily: FF }}
        >
          Otevřít Atlas <ArrowRight className="h-4 w-4" />
        </a>
        {anySent ? (
          <p className="mx-auto mt-5 max-w-[440px] text-[14px] text-[#001161]/70" style={{ fontFamily: FF }}>
            <T>Kolegům jsme poslali odkaz na Atlas vaším jménem. Kopii se seznamem adres máte v e-mailu.</T>
          </p>
        ) : null}
        <InviteResultList results={invites} tip />
        {inviteError ? (
          <p className="mx-auto mt-4 max-w-[440px] text-[13px] text-amber-700" style={{ fontFamily: FF }}>
            <T>{`Pozvánky kolegům: ${inviteError}`}</T>
          </p>
        ) : null}
        <ShareLink email={form.email.trim()} name={form.name.trim()} />
      </div>
    );
  }

  if (!path) {
    const options: { key: 'yes' | 'no'; title: string; text: string; icon: string; tone: string }[] = [
      { key: 'no', title: 'Ne, zatím nemáme', text: 'Krátká přihláška. Atlas a měsíc celé aplikace máte hned po odeslání.', icon: '+', tone: 'bg-[#f3eeff] text-[#7C3AED]' },
      { key: 'yes', title: 'Ano, naše škola Vividbooks má', text: 'Atlas máte ve svém účtu. Přihlaste se k pilotování a pozvěte kolegy.', icon: '✓', tone: 'bg-[#ecfdf5] text-[#059669]' },
    ];
    return (
      <div className={card}>
        <p className="mb-4 text-[20px] font-bold text-[#001161]" style={{ fontFamily: FF }}>
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
                <span className="text-[14px] text-[#001161]/60">
                  <T>{o.text}</T>
                </span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-[13px] text-[#001161]/55" style={{ fontFamily: FF }}>
          <T>Nevíte? Vyberte „Ano“. Podle e-mailu to poznáme.</T>
        </p>
      </div>
    );
  }

  if (path === 'yes' && !lookup?.found) {
    return (
      <form onSubmit={findSchool} noValidate className={card}>
        <BackLink onClick={() => go(null)} />
        <div className="grid gap-3">
          <label htmlFor="atlas-email" className="text-[14px] font-bold text-[#001161]" style={{ fontFamily: FF }}>
            Váš školní e-mail
          </label>
          <input id="atlas-email" className={INPUT} type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="jmeno@skola.cz" />
          <p className="-mt-1 text-[12px] text-[#001161]/50" style={{ fontFamily: FF }}>
            <T>Ten, se kterým se do Vividbooks přihlašujete. Podle něj najdeme vaši školu.</T>
          </p>
          {lookup && !lookup.found ? (
            <div className="rounded-[14px] border border-amber-200 bg-[#fff7ed] p-4 text-[14px] leading-relaxed text-[#001161]/80" style={{ fontFamily: FF }}>
              <strong className="block text-[#001161]">Tenhle e-mail u nás nemáme.</strong>
              <T>Jestli vaše škola Vividbooks nemá, vyplňte krátkou přihlášku.</T>
              <button type="button" onClick={() => go('no')} className="mt-2 block font-bold text-[#7C3AED] hover:underline">
                Vyplnit přihlášku →
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
    return (
      <form onSubmit={attach} noValidate className={card}>
        <BackLink onClick={() => setLookup(null)} />
        <div className="grid gap-3">
          <div className="flex items-center gap-3 rounded-[16px] border border-green-200 bg-[#ecfdf5] p-4" style={{ fontFamily: FF }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#059669] text-[14px] font-bold text-white">ZŠ</span>
            <span className="text-[14px] leading-snug text-[#001161]/80">
              <strong className="block text-[16px] text-[#001161]">{lookup.schoolName}</strong>
              <T>Atlas najdete ve svém účtu Vividbooks hned po přihlášení.</T>
            </span>
          </div>
          <input className={INPUT} placeholder="Jméno a příjmení *" value={form.name} onChange={set('name')} autoComplete="name" />
          <StagePicker stages={stages} onToggle={toggleStage} />
          <PilotCheckbox checked={wantsPilot} onChange={setWantsPilot} />
          {inviteFields}
          <Consent checked={gdpr} onChange={setGdpr} />
          <ErrorBox error={error} />
          <SubmitButton submitting={submitting}>{colleagues.length ? `Odeslat a pozvat kolegy (${colleagues.length})` : 'Odeslat'}</SubmitButton>
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
          <input className={INPUT} placeholder="Telefon (nepovinné)" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
        </div>
        <select className={`${INPUT} cursor-pointer`} value={form.position} onChange={set('position')}>
          <option value="" disabled>
            Co učíte? *
          </option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <StagePicker stages={stages} onToggle={toggleStage} />
        <PilotCheckbox checked={wantsPilot} onChange={setWantsPilot} />
        {inviteFields}
        <Consent checked={gdpr} onChange={setGdpr} />
        <ErrorBox error={error} />
        <SubmitButton submitting={submitting}>{colleagues.length ? `Chci Atlas a pozvat kolegy (${colleagues.length})` : 'Chci Atlas zdarma'}</SubmitButton>
        <p className="text-center text-[12px] text-[#001161]/45" style={{ fontFamily: FF }}>
          <T>Žádné platby ani automatické prodloužení. Po měsíci zůstane Atlas, zbytek aplikace se sám vypne.</T>
        </p>
      </div>
    </form>
  );
}

function FormSection() {
  return (
    <section id="prihlaska" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 md:px-12 md:py-24">
      <div className="mx-auto grid max-w-[1100px] items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="lg:sticky lg:top-28">
          <SectionTitle eyebrow="Přihláška" title="Atlas zdarma, aplikace na měsíc" body="Vyplníte jednou a máte hned přístup. Pilotování Zeměpisu je dobrovolné, zaškrtnete ho, jen když chcete." />
          <ul className="mt-6 grid gap-3" style={{ fontFamily: FF }}>
            {[
              'Vivid Atlas zdarma pro vás i vaše žáky',
              'Měsíc celé aplikace Vividbooks: učebnice, pracovní listy, testy, Vividboard',
              'Přednostní místo v pilotování nového Zeměpisu',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[16px] text-[#001161]/80">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#03CA90]/15">
                  <Check className="h-4 w-4 text-[#017d5b]" />
                </span>
                <T>{t}</T>
              </li>
            ))}
          </ul>
        </div>
        <AtlasForm />
      </div>
    </section>
  );
}

/* ─────────────────────────── pozvat kolegu ─────────────────────────── */

function InviteSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [message, setMessage] = useState(DEFAULT_INVITE_MESSAGE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<InviteResult[] | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Vyplňte prosím své jméno.');
    if (!isValidEmailFormat(email.trim())) return setError(EMAIL_FORMAT_HINT_CS);
    if (!emails.length) return setError('Zadejte alespoň jeden e-mail kolegy.');
    setSubmitting(true);
    setError('');
    const r = await sendInvites({ mode: 'atlas', inviterEmail: email.trim(), inviterName: name.trim(), emails, message });
    setSubmitting(false);
    if (r.error) return setError(r.error);
    setResults(r.results);
  };

  return (
    <section id="kolegove" className="scroll-mt-20 mx-3 rounded-[36px] px-4 py-16 sm:px-6 md:mx-6 md:px-12 md:py-20" style={{ background: NIGHT }}>
      <div className="mx-auto grid max-w-[1100px] items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <SectionTitle
            dark
            eyebrow="Pozvěte kolegu"
            title="Znáte zeměpisáře, kterému se Atlas bude hodit?"
            body="Kolegové z vaší školy i z jiných škol dostanou odkaz vaším jménem. Používáte Vividbooks? Pošlete Atlas zeměpisářům ve sborovně, ať ho mají taky."
          />
          <div className="mt-8 grid grid-cols-2 gap-3">
            <img src={IMG('hranice')} alt="Vývoj hranic v Atlasu" loading="lazy" className="aspect-[16/10] w-full rounded-[16px] object-cover object-left-top ring-1 ring-white/10" />
            <img src={IMG('biomy')} alt="Biomy v Atlasu" loading="lazy" className="aspect-[16/10] w-full rounded-[16px] object-cover object-left-top ring-1 ring-white/10" />
          </div>
        </div>
        {results ? (
          <div className="rounded-[26px] bg-white p-7 text-center md:p-9">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
            <h3 className="text-[24px] font-bold text-[#001161]" style={{ fontFamily: FF }}>
              Odesláno, děkujeme
            </h3>
            <p className="mx-auto mt-2 max-w-[400px] text-[15px] text-[#001161]/70" style={{ fontFamily: FF }}>
              <T>Kopii se seznamem adres jsme poslali i vám.</T>
            </p>
            <InviteResultList results={results} tip />
            <ShareLink email={email.trim()} name={name.trim()} />
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-3 rounded-[26px] bg-white p-5 md:p-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={INPUT} placeholder="Vaše jméno *" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              <input className={INPUT} placeholder="Váš e-mail *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <ColleaguesField label="Komu Atlas pošlete" emails={emails} onChange={setEmails} hint="Nejvýš 15 adres. Dostanou odkaz na Atlas vaším jménem." />
            <MessageField value={message} onChange={setMessage} />
            <ErrorBox error={error} />
            <SubmitButton submitting={submitting}>Poslat Atlas kolegům</SubmitButton>
            <p className="text-center text-[12px] text-[#001161]/45" style={{ fontFamily: FF }}>
              <T>E-mail odejde jednou, vaším jménem. Adresy kolegů nepoužijeme k ničemu dalšímu.</T>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────── FAQ ─────────────────────────── */

const FAQ = [
  { q: 'Je Atlas opravdu zdarma?', a: 'Ano. Učitel zeměpisu ho dostane zdarma a žáci ho můžou používat s ním. Měsíc celé aplikace Vividbooks je navíc a po měsíci se sám vypne, nic neplatíte a nic se samo neprodlužuje.' },
  { q: 'Co když naše škola Vividbooks už má?', a: 'Pak Atlas najdete hned po přihlášení svým účtem. V přihlášce vyberte „Ano“, přihlaste se k pilotování a pozvěte kolegy.' },
  { q: 'Co znamená pilotování Vividbooks Zeměpisu?', a: 'Chystáme novou řadu Zeměpisu pro 6.–9. ročník. Pilotní učitelé dostanou lekce, pracovní listy a mapy mezi prvními, vyzkouší je ve třídě a jejich připomínky se do řady promítnou. Je to dobrovolné a kdykoli můžete skončit.' },
  { q: 'Odkud jsou data?', a: 'Ze Světové banky (obyvatelstvo, ekonomika), z klimatické reanalýzy ERA5 (teploty a srážky), z WWF (biomy) a z historických datasetů Historical Basemaps a CShapes 2.0. U každého tématu je zdroj uvedený.' },
  { q: 'Na čem Atlas funguje?', a: 'V prohlížeči na interaktivní tabuli, počítači i tabletu. Nic se neinstaluje.' },
  { q: 'Hodí se i pro 1. stupeň?', a: 'Ano, ve vlastivědě se hodí hlavně mapy Česka a Evropy, světadíly, řeky a města. Ve formuláři zaškrtněte 1. stupeň.' },
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-20 mx-3 mt-3 rounded-[36px] bg-[#F6E2AB] px-4 py-16 sm:px-6 md:mx-6 md:px-12 md:py-20">
      <div className="mx-auto max-w-[820px]">
        <SectionTitle eyebrow="Časté otázky" title="Na co se učitelé ptají" align="center" />
        <div className="mt-10 grid gap-3">
          {FAQ.map((f, i) => (
            <div key={f.q} className="rounded-[18px] bg-white ring-1 ring-[#001161]/6">
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left" aria-expanded={open === i}>
                <span className="text-[17px] font-bold text-[#001161]" style={{ fontFamily: FF }}>
                  <T>{f.q}</T>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-[#001161]/50 transition ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i ? (
                <p className="px-6 pb-6 text-[15px] leading-relaxed text-[#001161]/70" style={{ fontFamily: FF }}>
                  <T>{f.a}</T>
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <PrimaryCta />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── stránka ─────────────────────────── */

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#001161]/8 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 md:px-10">
        <VividLogo />
        <nav className="hidden items-center gap-5 md:flex" aria-label="Navigace stránky" style={{ fontFamily: FF }}>
          {[
            ['#ukazky', 'Ukázky'],
            ['#co-umi', 'Co Atlas umí'],
            ['#jak', 'Jak to funguje'],
            ['#kolegove', 'Pozvat kolegu'],
            ['#faq', 'Otázky'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="text-[14px] font-bold text-[#001161]/56 transition hover:text-[#001161]">
              {label}
            </a>
          ))}
        </nav>
        <PrimaryCta className="px-4 py-2.5 text-[13px]" label="Chci Atlas" />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-[#06124F] px-4 py-10 sm:px-6 md:px-12">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 text-[14px] text-white/60" style={{ fontFamily: FF }}>
        <VividLogo color="#ffffff" />
        <span>
          Vividbooks s.r.o. ·{' '}
          <a href="mailto:hello@vividbooks.com" className="underline hover:text-white">
            hello@vividbooks.com
          </a>
        </span>
      </div>
    </footer>
  );
}

export function AtlasZdarmaLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Vivid Atlas zdarma pro učitele zeměpisu"
        description="Interaktivní atlas pro hodiny zeměpisu: glóbus, klima, obyvatelstvo, historické mapy a úkoly pro třídu. Pro učitele zeměpisu zdarma, k tomu měsíc celé aplikace Vividbooks."
        path={PAGE_PATH}
        image={IMG('teploty')}
        imageAlt="Vivid Atlas: teploty vzduchu po regionech a roční průběh"
        imageWidth={1600}
        imageHeight={1000}
        jsonLd={faqJsonLd(FAQ.map((f) => ({ question: f.q, answer: f.a })))}
      />
      <Header />
      <main>
      <Hero />
      <ShowcaseSection />
      <FeaturesSection />
      <StepsSection />
      <FormSection />
      <InviteSection />
      <FaqSection />
      </main>
      <Footer />
    </div>
  );
}
