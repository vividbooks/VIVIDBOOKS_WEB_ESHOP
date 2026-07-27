import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { SEOHead } from './SEOHead';
import { HeroAplikaceVideoBackground, HeroAplikaceVideoTitle, HERO_APLIKACE_POSTER } from './HeroAplikaceVideoSlide';
import { appUrl } from '../config/publicUrls';

const ff = "'Fenomen Sans', sans-serif";

/** Barvy webu (vividbooks.shared.css) */
const WB = {
  crimson: '#ff184a',
  darkBlue: '#001161',
  blue: '#5139ed',
  orange: '#ff8158',
  /** Tmavší varianta fialové — na drobné texty a štítky má #a89bff málo kontrastu */
  violetDeep: '#6b4fd8',
  violet: '#a89bff',
  mint: '#5ce8bf',
  yellow: '#ffdd00',
  rose: '#f46b7b',
  slate: '#4e5871',
} as const;

const APP_URL = appUrl();

/** Nová aplikace Vividbooks — odemyká se 3. 8. 2026 (lokální půlnoc). */
const NOVA_APLIKACE_LAUNCH_LABEL = '3. srpna';

function isNovaAplikaceUnlocked(at = new Date()): boolean {
  const launch = new Date(2026, 7, 3);
  launch.setHours(0, 0, 0, 0);
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day >= launch;
}

function useNovaAplikaceUnlocked(): boolean {
  const [unlocked, setUnlocked] = useState(() =>
    typeof window !== 'undefined' ? isNovaAplikaceUnlocked() : false,
  );
  useEffect(() => {
    setUnlocked(isNovaAplikaceUnlocked());
    const tick = window.setInterval(() => setUnlocked(isNovaAplikaceUnlocked()), 60_000);
    return () => window.clearInterval(tick);
  }, []);
  return unlocked;
}

type Panel = { bg: string; fg: string };

const NEWS: { tag: string; num: string; kicker: string; title: string; text: string; chip: string; panel: Panel }[] = [
  {
    tag: 'Novinka 01',
    num: '1',
    kicker: 'Účet a přihlášení',
    title: 'Jeden účet, jedno přihlášení',
    text:
      'Konec přepínání a dvojího přihlašování. Knihovna, vaše materiály i vividboardy jsou nově pod jedním účtem Vividbooks. Přihlásíte se kódem školy, e-mailem, přes Google nebo Microsoft — a kód školy si pak už nemusíte pamatovat.',
    chip: 'Jedno přihlášení ke všemu',
    panel: { bg: WB.crimson, fg: '#ffffff' },
  },
  {
    tag: 'Novinka 02',
    num: '2',
    kicker: 'Vividbooks AI',
    title: 'Umělá inteligence napříč celou aplikací',
    text:
      'Asistent vám pomůže s přípravou přímo u lekce. Vytvoří test nebo otázky, zjednoduší náročný text pro slabší žáky, navrhne aktivitu — a pamatuje si, na čem jste pracovali.',
    chip: 'Méně přípravy',
    panel: { bg: WB.blue, fg: '#ffffff' },
  },
  {
    tag: 'Novinka 03',
    num: '3',
    kicker: 'Dokumenty',
    title: 'Nové jednotné zobrazení materiálů',
    text:
      'Lekce, učební texty i metodiky jsou teď přehlednější. Čtenářský mód zvětší text pro celou třídu, materiál si zkopírujete a upravíte, sdílíte odkazem nebo vytisknete.',
    chip: 'Přehlednější u tabule',
    panel: { bg: WB.mint, fg: '#15185a' },
  },
  {
    tag: 'Novinka 04',
    num: '4',
    kicker: 'Pracovní listy',
    title: 'Nový editor pracovních listů',
    text:
      'Sestavte pracovní list z hotových bloků — texty, obrázky, tabulky i otázky. Nemusíte začínat od nuly: vezměte připravený list, upravte si ho a vytiskněte, klidně i se správným řešením.',
    chip: 'Tvorba i tisk na míru',
    panel: { bg: WB.yellow, fg: '#15185a' },
  },
  {
    tag: 'Novinka 05',
    num: '5',
    kicker: 'Nekonečná nástěnka',
    title: 'Nekonečná nástěnka — plátno bez hranic',
    text:
      'Zcela nový nástroj: volná plocha bez hranic. Rozmístíte text, kresby, obrázky i názorné matematické pomůcky — počítadla, číselné osy, domina, desítkové rámečky. Jako stvořené pro společný výklad na prvním stupni.',
    chip: 'Nový nástroj',
    panel: { bg: WB.violet, fg: '#ffffff' },
  },
  {
    tag: 'Novinka 06',
    num: '6',
    kicker: 'Vividboard',
    title: 'Promítání bez studentů a soutěžní módy',
    text:
      'Nové promítání bez studentů zvládne výklad i vyvolávání žáků i tam, kde jsou telefony zakázané — žáci nepotřebují vůbec nic. A soutěžní režimy (soutěž, týmy, duely) výuku oživí.',
    chip: 'Funguje i bez zařízení',
    panel: { bg: WB.rose, fg: '#ffffff' },
  },
  {
    tag: 'Novinka 07',
    num: '7',
    kicker: 'Početník',
    title: 'Početník — chytré procvičování matematiky',
    text:
      'Procvičování matematiky, které se přizpůsobí každému žákovi: slabší podrží, rychlejší popožene — a herní styl děti baví. Zadáte ho ve třídě, na doma i jako součást pracovního listu.',
    chip: 'Na míru žákovi',
    panel: { bg: WB.orange, fg: '#ffffff' },
  },
  {
    tag: 'Chystá se',
    num: 'Brzy',
    kicker: 'Moje třídy',
    title: 'Chystá se: Moje třídy',
    text:
      'Už brzy přibude správa tříd na jednom místě — třídy, žáci, úkoly i přehled výsledků. Přehled výsledků z testů a procvičování funguje už teď, zbytek dorazí na podzim.',
    chip: 'Připravujeme na podzim',
    panel: { bg: WB.slate, fg: '#ffffff' },
  },
];

const APP_SECTIONS = ['Knihovna', 'Můj obsah', 'AI asistent', 'Moje třída'] as const;

const HERO_POSTER = HERO_APLIKACE_POSTER;

type Door = {
  color: string;
  day: string;
  doorTitle: string;
  teaser: string;
  contentTitle: string;
  bullets: string[];
  foot: string;
};

const DOORS: Door[] = [
  {
    color: WB.crimson,
    day: 'Po · 24. 8.',
    doorTitle: 'Nová aplikace Vividbooks',
    teaser: 'Úvod a orientace — kde co najdete.',
    contentTitle: 'Nová aplikace',
    bullets: [
      'Vše na jednom místě, jedno přihlášení',
      'Zůstává, co znáte — jen přehlednější',
      'Rychlá orientace: kde co hledat',
      'Snadný přenos vašich materiálů',
    ],
    foot: 'Po 24. 8. · úvod',
  },
  {
    color: WB.blue,
    day: 'Út · 25. 8.',
    doorTitle: 'Umělá inteligence',
    teaser: 'Asistent, který učí s vámi.',
    contentTitle: 'Umělá inteligence',
    bullets: [
      'Připraví test i otázky za vás',
      'Zjednoduší text pro slabší žáky',
      'Poradí s přípravou hodiny',
      'Pamatuje si vaši práci',
    ],
    foot: 'Út 25. 8. · AI',
  },
  {
    color: WB.orange,
    day: 'St · 26. 8.',
    doorTitle: 'Editor pracovních listů',
    teaser: 'Tvorba i tisk na míru.',
    contentTitle: 'Pracovní listy',
    bullets: [
      'Vezměte hotový list a upravte si ho',
      'Přidejte vlastní otázky a příklady',
      'Vytiskněte i se správným řešením',
    ],
    foot: 'St 26. 8. · listy',
  },
  {
    color: WB.darkBlue,
    day: 'Čt · 27. 8.',
    doorTitle: 'Nový vividboard',
    teaser: 'Interaktivní výuka v jednom nástroji.',
    contentTitle: 'Vividboard',
    bullets: [
      'Prezentace, test i aktivity pohromadě',
      'Žáci se připojí kódem z lavice',
      'Promítání i tam, kde platí zákaz telefonů',
      'Hravé soutěže a přehled výsledků',
    ],
    foot: 'Čt 27. 8. · board',
  },
  {
    color: WB.violetDeep,
    day: 'Pá · 28. 8.',
    doorTitle: 'Adaptivní procvičování',
    teaser: 'Početník, který se přizpůsobí žákovi.',
    contentTitle: 'Početník',
    bullets: [
      'Reaguje na tempo každého žáka',
      'Slabší podrží, rychlejší popožene',
      'Zadáte ve třídě i na doma',
      'Míň opravování, víc přehledu',
    ],
    foot: 'Pá 28. 8. · procvičování',
  },
];

/* ── Tlačítka ─────────────────────────────────────────────────── */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 min-h-[48px] px-5 sm:px-7 rounded-md font-bold text-[14px] sm:text-[15px] transition-transform hover:scale-[1.02] active:scale-[0.98]';

function AppLaunchButton({ icon }: { icon?: React.ReactNode }) {
  const unlocked = useNovaAplikaceUnlocked();
  const label = 'Otevřít novou aplikaci';

  if (unlocked) {
    return (
      <a
        href={APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BTN_BASE} text-white shadow-[0_10px_26px_rgba(255,24,74,0.28)]`}
        style={{ fontFamily: ff, backgroundColor: WB.crimson }}
      >
        {label}
        {icon}
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled
      aria-label={`${label} — dostupné od ${NOVA_APLIKACE_LAUNCH_LABEL}`}
      className={`${BTN_BASE} cursor-not-allowed text-white/90 shadow-none opacity-70`}
      style={{ fontFamily: ff, backgroundColor: WB.crimson }}
    >
      {label}
      <span className="font-normal text-[12px] sm:text-[13px] opacity-90">· od {NOVA_APLIKACE_LAUNCH_LABEL}</span>
      {icon}
    </button>
  );
}

function BtnGhost({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={`${BTN_BASE} bg-white border border-[#001161]/12 hover:bg-[#f5f7fb]`}
      style={{ fontFamily: ff, color: WB.darkBlue }}
    >
      {children}
    </a>
  );
}

function SectionShell({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`px-5 sm:px-8 md:px-12 py-14 md:py-[4.5rem] ${className}`}>
      <div className="max-w-[1180px] mx-auto">{children}</div>
    </section>
  );
}

function SectionHead({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return (
    <div className="mb-8 md:mb-10 text-center">
      <p className="text-[12.5px] font-bold uppercase tracking-[1.4px]" style={{ fontFamily: ff, color: WB.crimson }}>
        {kicker}
      </p>
      <h2 className="text-[#001161] text-[28px] md:text-[40px] font-bold leading-[1.08] mt-2" style={{ fontFamily: ff }}>{title}</h2>
      <p className="text-[#4e5871] text-[15px] max-w-[52ch] mx-auto mt-3 leading-relaxed" style={{ fontFamily: ff }}>
        {text}
      </p>
    </div>
  );
}

/* ── Slider novinek ───────────────────────────────────────────── */

const AUTOPLAY_MS = 6500;

/** Výřez mozaiky pro levý panel slideru. */
const PANEL_PREVIEWS = [
  { crop: '8% 28%' },
  { crop: '20% 62%' },
  { crop: '36% 22%' },
  { crop: '50% 52%' },
  { crop: '64% 20%' },
  { crop: '78% 58%' },
  { crop: '88% 32%' },
  { crop: '44% 78%' },
] as const;
const PANEL_ZOOM = 1.52;

function NewsPanelSide({ slide, idx }: { slide: (typeof NEWS)[number]; idx: number }) {
  const preview = PANEL_PREVIEWS[idx % PANEL_PREVIEWS.length];

  return (
    <div className="relative overflow-hidden p-8 md:p-9 flex items-center justify-center md:min-h-[320px]">
      <img
        src={HERO_POSTER}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover [image-rendering:-webkit-optimize-contrast]"
        style={{
          objectPosition: preview.crop,
          transform: `scale(${PANEL_ZOOM})`,
          transformOrigin: preview.crop,
        }}
        loading="lazy"
        decoding="async"
      />

      <span
        className={`relative z-10 text-white font-bold leading-none ${
          slide.num.length > 2 ? 'text-[88px]' : 'text-[128px]'
        }`}
        style={{ fontFamily: ff }}
      >
        {slide.num}
      </span>
    </div>
  );
}

function NewsSlider() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((next: number) => {
    setI((next + NEWS.length) % NEWS.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => go(i + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [go, i, paused]);

  return (
    <div>
      <div
        className="relative rounded-[24px] border border-[#001161]/8 overflow-hidden bg-white shadow-[0_4px_24px_rgba(0,17,97,0.06)]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="flex transition-transform duration-700"
          style={{ transform: `translateX(-${i * 100}%)`, transitionTimingFunction: 'cubic-bezier(.16,1,.3,1)' }}
        >
          {NEWS.map((slide, idx) => (
            <div key={slide.title} className="min-w-full grid grid-cols-1 md:grid-cols-[300px_1fr]">
              <NewsPanelSide slide={slide} idx={idx} />

              <div className="p-8 md:p-11 flex flex-col justify-center">
                <h3 className="text-[#001161] text-[22px] md:text-[30px] font-bold leading-[1.12]" style={{ fontFamily: ff }}>{slide.title}</h3>
                <p className="text-[#4e5871] text-[15px] md:text-[16px] mt-3 max-w-[52ch] leading-relaxed" style={{ fontFamily: ff }}>
                  {slide.text}
                </p>
                <span
                  className="self-start mt-5 rounded-full border border-[#001161]/12 px-3.5 py-1.5 text-[12.5px] font-bold text-[#4e5871]"
                  style={{ fontFamily: ff }}
                >
                  {slide.chip}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex gap-2">
          {NEWS.map((slide, idx) => (
            <button
              key={slide.title}
              type="button"
              aria-label={`Novinka ${idx + 1}`}
              onClick={() => go(idx)}
              className={`size-[9px] rounded-full transition-transform ${
                idx === i ? 'bg-[#ff184a] scale-125' : 'bg-[#001161]/20 hover:bg-[#001161]/35'
              }`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Předchozí novinka"
            onClick={() => go(i - 1)}
            className="size-[42px] rounded-[9px] border border-[#001161]/12 bg-white hover:bg-[#f5f7fb] flex items-center justify-center text-[#001161]"
          >
            <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2.4} />
          </button>
          <button
            type="button"
            aria-label="Další novinka"
            onClick={() => go(i + 1)}
            className="size-[42px] rounded-[9px] border border-[#001161]/12 bg-white hover:bg-[#f5f7fb] flex items-center justify-center text-[#001161]"
          >
            <ChevronRight className="w-[18px] h-[18px]" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Konfety ──────────────────────────────────────────────────── */

type Particle = {
  x: number; y: number; vx: number; vy: number;
  gravity: number; size: number; rot: number; vr: number;
  color: string; life: number;
};

const CONFETTI_PALETTE = [WB.crimson, WB.blue, WB.orange, WB.violetDeep, WB.mint];

function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      raf.current = null;
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles.current) {
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 28));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    particles.current = particles.current.filter((p) => p.life > 0 && p.y < canvas.height + 40);
    raf.current = particles.current.length > 0 ? requestAnimationFrame(draw) : null;
  }, []);

  const spawn = useCallback(
    (x: number, y: number, count: number, power: number, color?: string) => {
      if (typeof window === 'undefined') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      for (let n = 0; n < count; n += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * power + 2;
        particles.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          gravity: 0.16 + Math.random() * 0.1,
          size: 5 + Math.random() * 6,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.3,
          color: color ?? CONFETTI_PALETTE[Math.floor(Math.random() * CONFETTI_PALETTE.length)],
          life: 55 + Math.random() * 35,
        });
      }
      if (raf.current == null) raf.current = requestAnimationFrame(draw);
    },
    [draw],
  );

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
      particles.current = [];
    };
  }, []);

  const burst = useCallback((x: number, y: number, color: string) => spawn(x, y, 48, 8, color), [spawn]);
  const blast = useCallback(() => {
    spawn(window.innerWidth * 0.3, window.innerHeight * 0.4, 90, 12);
    spawn(window.innerWidth * 0.7, window.innerHeight * 0.4, 90, 12);
  }, [spawn]);

  const canvas = <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[60]" aria-hidden />;

  return { canvas, burst, blast };
}

/* ── Adventní kalendář ────────────────────────────────────────── */

function CalendarTile({
  door,
  isOpen,
  onToggle,
}: {
  door: Door;
  isOpen: boolean;
  onToggle: (rect: DOMRect) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);

  const toggle = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) onToggle(rect);
  };

  const rotation = isOpen ? -115 : hovered ? -13 : 0;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      aria-label={`${door.day} — ${door.doorTitle}`}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative aspect-[16/11] sm:aspect-[3/4.75] lg:aspect-[3/5] min-h-[248px] sm:min-h-[300px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#5139ed] focus-visible:ring-offset-2 rounded-[16px] [perspective:1500px]"
    >
      {/* Obsah pod dvířky */}
      <div
        className="absolute inset-0 z-[1] rounded-[16px] border border-[#001161]/8 bg-white p-4 sm:p-[18px] flex flex-col min-h-0 overflow-hidden shadow-[inset_0_2px_24px_rgba(0,17,97,0.05)]"
        style={{ color: door.color }}
      >
        <span className="h-2 w-[34px] rounded-[2px] mb-2.5 shrink-0" style={{ backgroundColor: door.color }} />
        <p
          className="text-[#001161] font-bold text-[14px] sm:text-[15px] leading-[1.22] shrink-0"
          style={{ fontFamily: ff }}
        >
          {door.contentTitle}
        </p>
        <ul className="mt-1.5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
          {door.bullets.map((bullet) => (
            <li
              key={bullet}
              className="relative text-[11.5px] sm:text-[12px] leading-[1.32] text-[#33322d] py-[5px] pl-[15px] border-t border-[#001161]/8 first:border-t-0"
              style={{ fontFamily: ff }}
            >
              <span className="absolute left-0 top-[10px] size-[6px] rounded-[2px]" style={{ backgroundColor: door.color }} />
              {bullet}
            </li>
          ))}
        </ul>
        <p
          className="shrink-0 mt-2 border-t border-[#001161]/8 pt-2 text-[10.5px] sm:text-[11px] font-bold text-[#4e5871]"
          style={{ fontFamily: ff }}
        >
          {door.foot}
        </p>
      </div>

      {/* Dvířka */}
      <div
        className="absolute inset-0 z-[2] rounded-[16px] border border-[#001161]/8 bg-white p-5 flex flex-col justify-between overflow-hidden origin-left [transform-style:preserve-3d] [backface-visibility:hidden] transition-[transform,box-shadow] duration-700"
        style={{
          transform: `rotateY(${rotation}deg)`,
          transitionTimingFunction: 'cubic-bezier(.34,1.3,.4,1)',
          boxShadow: isOpen
            ? '30px 0 46px rgba(0,17,97,0.16)'
            : hovered
              ? '14px 6px 30px rgba(0,17,97,0.10)'
              : '0 8px 22px rgba(0,17,97,0.05)',
        }}
      >
        <span
          className="self-start rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.6px] text-white"
          style={{ fontFamily: ff, backgroundColor: door.color }}
        >
          {door.day}
        </span>
        <p className="text-[#001161] text-[21px] font-bold leading-[1.12] mt-3" style={{ fontFamily: ff }}>{door.doorTitle}</p>
        <div>
          <p className="text-[13px] text-[#4e5871]" style={{ fontFamily: ff }}>
            {door.teaser}
          </p>
          <span
            className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-bold"
            style={{ fontFamily: ff, color: door.color }}
          >
            Otevřít okénko
            <ChevronRight className="size-3.5" strokeWidth={3} />
          </span>
        </div>
        <span className="absolute top-0 right-0 bottom-0 w-[9px] rounded-r-[16px]" style={{ backgroundColor: door.color }} />
      </div>
    </div>
  );
}

function AdventCalendar() {
  const [openDays, setOpenDays] = useState<string[]>([]);
  const { canvas, burst, blast } = useConfetti();
  const allOpen = openDays.length === DOORS.length;
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (allOpen && !celebratedRef.current) {
      celebratedRef.current = true;
      blast();
    }
  }, [allOpen, blast]);

  const handleToggle = (door: Door, rect: DOMRect) => {
    setOpenDays((prev) => {
      if (prev.includes(door.day)) return prev.filter((d) => d !== door.day);
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, door.color);
      return [...prev, door.day];
    });
  };

  return (
    <>
      {canvas}

      <SectionHead
        kicker="Přípravný týden · webináře"
        title="Adventní kalendář novinek"
        text="Ano, adventní kalendář v srpnu. Naším Štědrým dnem je totiž první září — a než u tabule zazvoní, rozbalujeme novinky den po dni. Pět okének, pět dárků pro váš nový školní rok. Klikněte a nahlédněte, co jsme nadělili."
      />

      <div className="max-w-[260px] mx-auto -mt-2 mb-8">
        <div className="h-2 rounded-full bg-[#f1efe7] border border-[#001161]/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${(openDays.length / DOORS.length) * 100}%`,
              background: `linear-gradient(90deg, ${WB.crimson}, ${WB.orange})`,
              transitionTimingFunction: 'cubic-bezier(.16,1,.3,1)',
            }}
          />
        </div>
        <p className="mt-2 text-center text-[12.5px] font-bold text-[#4e5871]" style={{ fontFamily: ff }}>
          Otevřeno <span style={{ color: WB.crimson }}>{openDays.length}</span> / {DOORS.length}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
        {DOORS.map((door) => (
          <CalendarTile
            key={door.day}
            door={door}
            isOpen={openDays.includes(door.day)}
            onToggle={(rect) => handleToggle(door, rect)}
          />
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          to="/webinare"
          className="inline-flex items-center gap-2 font-bold text-[15px] hover:underline"
          style={{ fontFamily: ff, color: WB.blue }}
        >
          Přihlásit se na webináře
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </>
  );
}

/* ── Stránka ──────────────────────────────────────────────────── */

export function AplikacePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-white"
    >
      <SEOHead
        title="Nová aplikace Vividbooks"
        path="/aplikace"
        description="V srpnu spouštíme novou aplikaci Vividbooks. Knihovna, lekce, procvičování, vividboard i umělá inteligence — vše na jednom místě, pod jedním přihlášením."
      />

      {/* Hero */}
      <section className="px-5 sm:px-8 md:px-12 pt-6 md:pt-8 pb-14 md:pb-[4.5rem]">
        <div className="max-w-[1180px] mx-auto">
          <div className="relative overflow-hidden rounded-[24px] bg-white min-h-[420px] md:min-h-[540px]">
            <HeroAplikaceVideoBackground priority />
            <div className="relative flex min-h-[420px] md:min-h-[540px] flex-col">
              <div className="flex flex-1 flex-col items-center justify-center px-6 pt-10 md:px-12 md:pt-14">
                <span
                  className="mb-4 md:mb-5 rounded-full border border-white/40 bg-white/15 px-4 py-1.5 text-[13px] md:text-[14px] font-bold text-white backdrop-blur-[2px]"
                  style={{ fontFamily: ff }}
                >
                  Odemykáme {NOVA_APLIKACE_LAUNCH_LABEL}
                </span>
                <HeroAplikaceVideoTitle line1="Nová aplikace" line2="Vividbooks" />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 md:gap-3 px-6 pb-5 md:px-12 md:pb-6">
                {APP_SECTIONS.map((section) => (
                  <span
                    key={section}
                    className="rounded-[10px] bg-[#fdeeee] px-4 py-2 text-[15px] md:text-[17px] font-bold text-[#001161]"
                    style={{ fontFamily: ff }}
                  >
                    {section}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p
            className="text-[#3b4463] text-[16px] md:text-[19px] max-w-[56ch] mx-auto text-center leading-relaxed mt-8 md:mt-10"
            style={{ fontFamily: ff }}
          >
            V srpnu spouštíme novou aplikaci Vividbooks. Stará poběží souběžně až do 1. ledna, takže na přechod máte spoustu času — ale
            podívejte se už teď, co všechno nová aplikace nabízí.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7 md:mt-8">
            <AppLaunchButton icon={<ArrowRight className="w-4 h-4" />} />
            <BtnGhost href="#novinky">Prohlédnout novinky</BtnGhost>
          </div>
        </div>
      </section>

      {/* Adventní kalendář */}
      <SectionShell id="kalendar" className="bg-[#f5f7fb]">
        <AdventCalendar />
      </SectionShell>

      {/* Co je nové */}
      <SectionShell id="novinky">
        <SectionHead
          kicker="Co je nové"
          title="Největší novinky nové aplikace"
          text="Podívejte se, co se mění a v čem vám aplikace nově usnadní práci. Listujte šipkami nebo tečkami."
        />
        <NewsSlider />
      </SectionShell>

      {/* CTA */}
      <SectionShell>
        <div className="relative overflow-hidden rounded-[24px] min-h-[320px] md:min-h-[400px] text-center">
          <HeroAplikaceVideoBackground />
          <div className="relative z-10 px-8 py-14 md:px-12 md:py-[3.25rem]">
            <h2 className="text-white text-[26px] md:text-[38px] font-bold leading-tight max-w-[22ch] mx-auto" style={{ fontFamily: ff }}>
              Vyzkoušejte novou aplikaci ještě dnes.
            </h2>
            <p className="text-white text-[15px] max-w-[54ch] mx-auto mt-3 leading-relaxed" style={{ fontFamily: ff }}>
              Vše, na co jste zvyklí — knihovna, lekce i procvičování — a k tomu všechny novinky na jednom místě. Přihlásíte se stejně
              jako dosud.
            </p>
            <div className="mt-6 flex justify-center">
              <AppLaunchButton icon={<ExternalLink className="w-4 h-4 opacity-90" />} />
            </div>
          </div>
        </div>

        <p className="text-center text-[13px] text-[#4e5871] mt-8" style={{ fontFamily: ff }}>
          Nová aplikace a adventní kalendář novinek. Termíny a obsah se mohou drobně upravit.
        </p>
      </SectionShell>
    </motion.div>
  );
}
