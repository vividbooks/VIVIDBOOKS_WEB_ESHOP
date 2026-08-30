import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { SEOHead } from './SEOHead';
import { HeroAplikaceVideoBackground } from './HeroAplikaceVideoSlide';
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


/* ── Dlaždice témat ───────────────────────────────────────────── */

type Topic = {
  /** Slug článku v Novinkách, na který dlaždice vede. */
  slug: string;
  image: string;
  title: string;
  bullets: [string, string, string];
};

const TOPICS: Topic[] = [
  {
    slug: 'nova-aplikace-vividbooks-jeden-ucet-a-nova-knihovna',
    image: '/aplikace/tema-01-nova-aplikace.webp',
    title: 'Nová aplikace a knihovna pod jedním účtem',
    bullets: [
      'Jeden účet pro knihovnu i Vividboard, bez přepínání',
      'Čtenářský mód a ovládání zoomu pro interaktivní tabuli',
      'Kódy stránek: z papírového sešitu skočíte přímo do aplikace',
    ],
  },
  {
    slug: 'vividbooks-ai-asistent-ktery-zna-nase-ucebnice',
    image: '/aplikace/tema-02-umela-inteligence.webp',
    title: 'Vividbooks AI napříč celou aplikací',
    bullets: [
      'Z chatu rovnou test nebo interaktivní board',
      'Umí pracovat i s vaším vlastním PDF',
      'Formativní hodnocení testů, které si můžete doladit',
    ],
  },
  {
    slug: 'novy-editor-pracovnich-listu',
    image: '/aplikace/tema-03-pracovni-listy.webp',
    title: 'Nový editor pracovních listů',
    bullets: [
      'Texty, obrázky, volný prostor i hotové aktivity',
      'Otázky systém chápe jako otázky — list převedete na board',
      'Sady příkladů vygeneruje Početník podle ročníku a úrovní',
    ],
  },
  {
    slug: 'novy-vividboard-aktivity-a-soutezni-rezimy',
    image: '/aplikace/tema-04-vividboard.webp',
    title: 'Nový Vividboard a soutěžní režimy',
    bullets: [
      'Klávesnice na příklady, videokvíz, poznávačka, kartičky',
      'Soutěž, týmy i duely — nebo promítání zcela bez telefonů',
      'Obsah ze starého Vividboardu si jednorázově přenesete',
    ],
  },
  {
    slug: 'pocetnik-adaptivni-procvicovani-matematiky',
    image: '/aplikace/tema-05-pocetnik.webp',
    title: 'Početník: adaptivní procvičování matematiky',
    bullets: [
      'Tři režimy: procvičovat hned, zadat ve výuce, vytisknout sadu',
      'Úroveň se mění podle odpovědí, ne podle pořadí úloh',
      'Ve vyhodnocení vidíte úspěšnost po jednotlivých úrovních',
    ],
  },
];

/** `wide` = dlaždice na celou šířku mřížky, aby poslední z nepárového počtu nezůstala osamocená. */
function TopicTile({ topic, wide = false }: { topic: Topic; wide?: boolean }) {
  return (
    <Link
      to={`/novinky/${topic.slug}`}
      className={`group flex flex-col overflow-hidden rounded-[20px] bg-white border border-[#001161]/8 transition-transform hover:-translate-y-1 ${
        wide ? 'md:col-span-2 md:flex-row' : ''
      }`}
    >
      <img
        src={topic.image}
        alt={topic.title}
        loading="lazy"
        className={`w-full aspect-[1240/820] object-cover ${wide ? 'md:w-1/2 md:self-stretch md:aspect-auto' : ''}`}
      />

      <div className={`flex flex-1 flex-col p-6 md:p-7 ${wide ? 'md:w-1/2 md:justify-center' : ''}`}>
        <h2 className="text-[#001161] text-[20px] md:text-[23px] font-bold leading-[1.2]" style={{ fontFamily: ff }}>
          {topic.title}
        </h2>
        <ul className="mt-4 space-y-2">
          {topic.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2.5 text-[14.5px] leading-snug text-[#3b4463]" style={{ fontFamily: ff }}>
              <span aria-hidden className="mt-[7px] size-[6px] shrink-0 rounded-full" style={{ backgroundColor: WB.crimson }} />
              {bullet}
            </li>
          ))}
        </ul>

        <span
          className="mt-6 inline-flex items-center gap-2 font-bold text-[14.5px] group-hover:underline"
          style={{ fontFamily: ff, color: WB.blue }}
        >
          Číst celý článek
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
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
        description="Nová aplikace Vividbooks je tady. Knihovna, lekce, procvičování, vividboard i umělá inteligence — vše na jednom místě, pod jedním přihlášením. Původní aplikace běží souběžně do 1. ledna."
      />

      {/* Úvod */}
      <section className="px-5 sm:px-8 md:px-12 pt-10 md:pt-16 pb-4 md:pb-8">
        <div className="max-w-[860px] mx-auto text-center">
          <p className="text-[12.5px] font-bold uppercase tracking-[1.4px]" style={{ fontFamily: ff, color: WB.crimson }}>
            Nová aplikace
          </p>
          <h1
            className="text-[#001161] text-[32px] sm:text-[40px] md:text-[54px] font-bold leading-[1.06] mt-3"
            style={{ fontFamily: ff }}
          >
            Nová aplikace Vividbooks je tady
          </h1>
          <p
            className="text-[#3b4463] text-[16px] md:text-[19px] max-w-[58ch] mx-auto leading-relaxed mt-5 md:mt-6"
            style={{ fontFamily: ff }}
          >
            Je rychlejší, přehlednější a konečně celá pod jedním přihlášením — knihovna i Vividboard na jednom místě. Původní
            aplikace běží souběžně až do 1. ledna, takže na přechod máte spoustu času.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7 md:mt-8">
            <AppLaunchButton icon={<ArrowRight className="w-4 h-4" />} />
            <BtnGhost href="#temata">Prohlédnout novinky</BtnGhost>
          </div>
        </div>
      </section>

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

      {/* Pět témat do hloubky */}
      <SectionShell id="temata" className="bg-[#f5f7fb]">
        <div className="mb-8 md:mb-10 text-center">
          <p className="text-[12.5px] font-bold uppercase tracking-[1.4px]" style={{ fontFamily: ff, color: WB.crimson }}>
            Pět témat podrobně
          </p>
          <p className="text-[#4e5871] text-[15px] max-w-[56ch] mx-auto mt-3 leading-relaxed" style={{ fontFamily: ff }}>
            Každou novinku jsme na konci srpna ukazovali naživo v miniwebináři. Rozklikněte si téma, které vás zajímá — u každého je
            i odkaz na záznam a na dotazník, kterým si vystavíte certifikát DVPP.
          </p>
        </div>

        <div className="grid gap-6 md:gap-7 md:grid-cols-2">
          {TOPICS.map((topic, idx) => (
            <TopicTile
              key={topic.slug}
              topic={topic}
              wide={TOPICS.length % 2 === 1 && idx === TOPICS.length - 1}
            />
          ))}
        </div>
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
          Aplikaci průběžně dolaďujeme, takže se termíny a obsah mohou drobně upravit.
        </p>
      </SectionShell>
    </motion.div>
  );
}
