import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ArrowRight, ChevronRight, ExternalLink } from 'lucide-react';
import { SEOHead } from './SEOHead';
import { HeroAplikaceVideoBackground, HeroAplikaceVideoTitle } from './HeroAplikaceVideoSlide';
import { SubjectTabsSection, type SubjectExtraTab } from './SubjectTabsSection';
import { APP_ENTRY_PATH } from '../config/publicUrls';
import { APP_ENTRY_RESET_PARAM } from '@/lib/appEntryChoice';

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

/**
 * Tahle stránka je celá o nové aplikaci, takže se rozcestník musí zeptat i toho, kdo si
 * dřív vybral původní aplikaci — jinak by tlačítko slibovalo novou a otevřelo starou.
 */
const APP_ENTRY_CHOOSE_URL = `${APP_ENTRY_PATH}?${APP_ENTRY_RESET_PARAM}=1`;

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

const APP_SECTIONS = ['Knihovna', 'Můj obsah', 'AI asistent', 'Moje třída'] as const;

const NEWS: { kicker: string; title: string; text: string }[] = [
  {
    kicker: 'Účet a přihlášení',
    title: 'Jeden účet, jedno přihlášení',
    text:
      'Konec přepínání a dvojího přihlašování. Knihovna, vaše materiály i vividboardy jsou nově pod jedním účtem Vividbooks. Přihlásíte se kódem školy, e-mailem, přes Google nebo Microsoft — a kód školy si pak už nemusíte pamatovat.',
  },
  {
    kicker: 'Vividbooks AI',
    title: 'Umělá inteligence napříč celou aplikací',
    text:
      'Asistent vám pomůže s přípravou přímo u lekce. Vytvoří test nebo otázky, zjednoduší náročný text pro slabší žáky, navrhne aktivitu — a pamatuje si, na čem jste pracovali.',
  },
  {
    kicker: 'Dokumenty',
    title: 'Nové jednotné zobrazení materiálů',
    text:
      'Lekce, učební texty i metodiky jsou teď přehlednější. Čtenářský mód zvětší text pro celou třídu, materiál si zkopírujete a upravíte, sdílíte odkazem nebo vytisknete.',
  },
  {
    kicker: 'Pracovní listy',
    title: 'Nový editor pracovních listů',
    text:
      'Sestavte pracovní list z hotových bloků — texty, obrázky, tabulky i otázky. Nemusíte začínat od nuly: vezměte připravený list, upravte si ho a vytiskněte, klidně i se správným řešením.',
  },
  {
    kicker: 'Nekonečná nástěnka',
    title: 'Nekonečná nástěnka — plátno bez hranic',
    text:
      'Zcela nový nástroj: volná plocha bez hranic. Rozmístíte text, kresby, obrázky i názorné matematické pomůcky — počítadla, číselné osy, domina, desítkové rámečky. Jako stvořené pro společný výklad na prvním stupni.',
  },
  {
    kicker: 'Vividboard',
    title: 'Promítání bez studentů a soutěžní módy',
    text:
      'Nové promítání bez studentů zvládne výklad i vyvolávání žáků i tam, kde jsou telefony zakázané — žáci nepotřebují vůbec nic. Soutěžní režimy (soutěž, týmy, duely) výuku oživí. A editor vividboardu je teď výrazně intuitivnější — snadněji přidáte obsah, upravíte rozvržení i připravíte board na hodinu.',
  },
  {
    kicker: 'Početník',
    title: 'Početník — chytré procvičování matematiky',
    text:
      'Procvičování matematiky, které se přizpůsobí každému žákovi: slabší podrží, rychlejší popožene — a herní styl děti baví. Zadáte ho ve třídě, na doma i jako součást pracovního listu.',
  },
  {
    kicker: 'Moje třídy',
    title: 'Chystá se: Moje třídy',
    text:
      'Už brzy přibude správa tříd na jednom místě — třídy, žáci, úkoly i přehled výsledků. Přehled výsledků z testů a procvičování funguje už teď, zbytek dorazí na podzim.',
  },
];

const APLIKACE_NEWS_TAB_COLORS = ['#fee0ad', '#89f2ce', '#dee4f1', '#ffbe7a', '#ffc5b6'] as const;

/** Náhledy novinek — doplňovat postupně do public/aplikace/news-XX-….png */
const APLIKACE_NEWS_IMAGES: Partial<Record<number, { src: string; fit?: 'cover' | 'contain' }>> = {
  0: { src: '/aplikace/news-01-knihovna.png', fit: 'contain' },
  1: { src: '/aplikace/news-02-ai.png', fit: 'contain' },
  2: { src: '/aplikace/news-03-dokumenty.png', fit: 'contain' },
  3: { src: '/aplikace/news-04-pracovni-listy.png', fit: 'contain' },
  4: { src: '/aplikace/news-05-nastenka.png', fit: 'contain' },
  5: { src: '/aplikace/news-06-vividboard.png', fit: 'contain' },
  6: { src: '/aplikace/news-07-pocetnik.png', fit: 'contain' },
  7: { src: '/aplikace/news-08-moje-tridy.png', fit: 'contain' },
};

const APLIKACE_NEWS_TABS: SubjectExtraTab[] = NEWS.map((item, idx) => {
  const preview = APLIKACE_NEWS_IMAGES[idx];
  return {
    id: `aplikace-news-${idx + 1}`,
    tabText: item.kicker,
    contentHeadline: item.title,
    contentRichText: item.text,
    bgColor: APLIKACE_NEWS_TAB_COLORS[idx % APLIKACE_NEWS_TAB_COLORS.length],
    ...(preview?.src
      ? { contentImage: preview.src, contentImageFit: preview.fit ?? 'contain' }
      : {}),
    order: idx + 1,
  };
});

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
      <Link
        to={APP_ENTRY_CHOOSE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BTN_BASE} text-white shadow-[0_10px_26px_rgba(255,24,74,0.28)]`}
        style={{ fontFamily: ff, backgroundColor: WB.crimson }}
      >
        {label}
        {icon}
      </Link>
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
      <section id="novinky">
        <div className="px-5 sm:px-8 md:px-12 pt-14 md:pt-[4.5rem] pb-8 md:pb-10">
          <div className="max-w-[1180px] mx-auto">
            <SectionHead
              kicker="Co je nové"
              title="Největší novinky nové aplikace"
              text="Vyberte novinku v menu vlevo — u každé uvidíte, co se mění a v čem vám aplikace usnadní práci."
            />
          </div>
        </div>
        <SubjectTabsSection
          subject="Fyzika"
          displayName="Fyzika"
          light
          staticTabs={APLIKACE_NEWS_TABS}
          sectionHeading="Co je nové v aplikaci?"
        />
      </section>

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
