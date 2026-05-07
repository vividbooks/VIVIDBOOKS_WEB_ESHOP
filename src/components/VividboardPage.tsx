import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight, ExternalLink, ArrowRight, Play } from 'lucide-react';
import { SEOHead } from './SEOHead';
import { SITE_URL } from '../utils/ogImage';

const ff = "'Fenomen Sans', sans-serif";
const cooper = "font-['Cooper_Light',serif]";

/** Barvy z Webflow (vividbooks.shared.css) — vividboard landing */
const WB = {
  crimson: '#ff184a',
  darkBlue: '#001161',
  blue: '#5139ed',
  slate: '#4e5871',
  lightGrey: '#dee4f1',
  /** Karty „Co dnes vytvoříte“ — stejné jako .vboard-card-wrap.* */
  card: {
    kvizy: 'bg-[#5ce8bf] text-[#15185a]',
    lekce: 'bg-[#a89bff] text-white',
    materialy: 'bg-[#dee4f1] text-[#15185a]',
    testy: 'bg-[#f46b7b] text-white',
    dotazniky: 'bg-[#ffdd00] text-[#15185a]',
    karty: 'bg-[rgba(255,129,88,0.88)] text-white',
  } as const,
} as const;

const VB = '/vividboard';

const HERO_SLIDE_COUNT = 7;
const HERO_SLIDES = Array.from({ length: HERO_SLIDE_COUNT }, (_, i) => `${VB}/hero-slider-${i + 1}.webp`);

type CardVariant = keyof typeof WB.card;

const CREATION_CARDS: { label: string; image: string; href: string; variant: CardVariant }[] = [
  {
    label: 'Soutěžní kvízy',
    image: `${VB}/card-soutezni-kvizy.avif`,
    href: `${SITE_URL}/cs/vividboard/inspirace/hudebni-vychova-kviz-popularni-hudby`,
    variant: 'kvizy',
  },
  {
    label: 'Interaktivní lekce',
    image: `${VB}/card-interaktivni-lekce.avif`,
    href: `${SITE_URL}/cs/vividboard/inspirace/dejepis-zacatek-1-svetove-valky`,
    variant: 'lekce',
  },
  {
    label: 'Učební materiály a prezentace',
    image: `${VB}/card-ucebni-materialy.avif`,
    href: `${SITE_URL}/cs/vividboard/inspirace/prvociselny-rozklad-na-soucin`,
    variant: 'materialy',
  },
  {
    label: 'Testy a písemky',
    image: `${VB}/card-testy-pisemky.avif`,
    href: `${SITE_URL}/cs/vividboard/inspirace/chemie-smesi`,
    variant: 'testy',
  },
  {
    label: 'Dotazníky',
    image: `${VB}/card-dotazniky.avif`,
    href: `${SITE_URL}/cs/vividboard/inspirace/prihlaska-na-skolni-vylet`,
    variant: 'dotazniky',
  },
  {
    label: 'Studijní karty',
    image: `${VB}/card-studijni-karty.avif`,
    href: `${SITE_URL}/cs/vividboard/inspirace/anglicky-jazyk-zakladni-slovicka`,
    variant: 'karty',
  },
];

const INSPIRATION = [
  {
    title: 'Soutěžní kvízy',
    items: [
      { label: 'Hudební výchova: Kvíz populární hudby', href: `${SITE_URL}/cs/vividboard/inspirace/hudebni-vychova-kviz-popularni-hudby` },
      { label: 'Informatika: Úniková hra', href: `${SITE_URL}/cs/vividboard/inspirace/informatika-unikova-hra` },
    ],
  },
  {
    title: 'Interaktivní lekce',
    items: [
      { label: 'Dějepis: Začátek 1. světové války', href: `${SITE_URL}/cs/vividboard/inspirace/dejepis-zacatek-1-svetove-valky` },
      { label: 'Fyzika: Skládání sil', href: `${SITE_URL}/cs/vividboard/inspirace/fyzika-skladani-sil` },
    ],
  },
  {
    title: 'Učební materiály a prezentace',
    items: [
      { label: 'Matematika: Vzájemná poloha dvou přímek', href: `${SITE_URL}/cs/vividboard/inspirace/vzajemna-poloha-dvou-primek` },
      { label: 'Matematika: Prvočíselný rozklad na součin', href: `${SITE_URL}/cs/vividboard/inspirace/prvociselny-rozklad-na-soucin` },
    ],
  },
  {
    title: 'Testy a písemky',
    items: [
      { label: 'Matematika: Odčítání desetinných čísel', href: `${SITE_URL}/cs/vividboard/inspirace/odcitani-desetinnych-cisel` },
      { label: 'Chemie: Směsi', href: `${SITE_URL}/cs/vividboard/inspirace/chemie-smesi` },
    ],
  },
  {
    title: 'Dotazníky',
    items: [
      { label: 'Spokojenost ve škole', href: `${SITE_URL}/cs/vividboard/inspirace/spokojenost-ve-skole` },
      { label: 'Přihláška na školní výlet', href: `${SITE_URL}/cs/vividboard/inspirace/prihlaska-na-skolni-vylet` },
    ],
  },
  {
    title: 'Procvičování a studijní karty',
    items: [
      { label: 'Přírodopis: Savci a ptáci', href: `${SITE_URL}/cs/vividboard/inspirace/prirodopis-savci-a-ptaci` },
      { label: 'Anglický jazyk: Základní slovíčka', href: `${SITE_URL}/cs/vividboard/inspirace/anglicky-jazyk-zakladni-slovicka` },
    ],
  },
] as const;

const THREE_STEPS = [
  {
    image: `${VB}/krok-1-editor.png`,
    title: 'Vytvořte si vlastní online interaktivní učební materiál!',
    text:
      'Využijte náš jednoduchý editor k vytvoření informačních a obsahových obrazovek. Ve Vividboardu vytvoříte nejen informační prezentace, ale i interaktivní aktivity.',
  },
  {
    image: `${VB}/krok-2-responzivni.webp`,
    title: 'Přehrávejte ho nebo sdílejte!',
    text:
      'Vytvořený obsah můžete promítat, zapojit studenty přes jejich zařízení, poslat studentům na později nebo vytvořit soutěž.',
  },
  {
    image: `${VB}/krok-3-prehled.webp`,
    title: 'Analyzujte výsledky',
    text:
      'Zajímá vás celkový přehled úspěšnosti studentů? V sekci analýza získáte přehled o tom, jak je téma problematické a jak mu studenti rozumí.',
  },
] as const;

const TOOLS = [
  { image: `${VB}/tool-osnova.webp`, title: 'Nástroj osnova', text: 'Přidejte prezentaci řád — navigace pro vás i studenty, i u dlouhých materiálů.' },
  { image: `${VB}/tool-ai.webp`, title: 'Umělá inteligence', text: 'Nápady na prezentace, testy i slovní hodnocení přímo ve Vividboardu.' },
  { image: `${VB}/tool-interactive.webp`, title: 'Interaktivní prvky', text: 'Galerie, vložený web, Geogebra — víc než statické PDF.' },
  { image: `${VB}/tool-templates.webp`, title: 'Šablony', text: 'Přednastavené vzhledy bez nutnosti být designérem.' },
  { image: `${VB}/tool-competition.webp`, title: 'Mód soutěž', text: 'Body, hudba, napětí — u vyhodnotitelných aktivit.' },
  { image: `${VB}/tool-annotations.webp`, title: 'Anotace', text: 'Kresba a poznámky v režimu promítání, export výsledku.' },
] as const;

const VIDEO_HREF = `${SITE_URL}/video/tvorba-vlastnich-interaktivnich-materialu`;

function BtnPrimary({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls =
    'inline-flex items-center justify-center gap-2 min-h-[48px] px-5 sm:px-8 rounded-md font-bold text-[14px] sm:text-[15px] text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]';
  const style = { fontFamily: ff, backgroundColor: WB.crimson };
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={cls} style={style}>
      {children}
    </Link>
  );
}

function BtnDarkBlue({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls =
    'inline-flex items-center justify-center gap-2 min-h-[48px] px-5 sm:px-8 rounded-md font-bold text-[14px] sm:text-[15px] text-white transition-transform hover:scale-[1.02] active:scale-[0.98]';
  const style = { fontFamily: ff, backgroundColor: WB.darkBlue };
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={cls} style={style}>
      {children}
    </Link>
  );
}

function SectionShell({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`px-5 sm:px-8 md:px-12 py-14 md:py-[4.5rem] ${className}`}>
      <div className="max-w-[1180px] mx-auto">{children}</div>
    </section>
  );
}

function HeroSlider() {
  const [i, setI] = useState(0);
  const go = useCallback((d: number) => {
    setI((prev) => (prev + d + HERO_SLIDE_COUNT) % HERO_SLIDE_COUNT);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => go(1), 12000);
    return () => window.clearInterval(t);
  }, [go]);

  return (
    <div className="w-full">
      <p
        className="text-[13px] sm:text-[14px] font-semibold tracking-wide mb-3 px-5 text-center uppercase"
        style={{ fontFamily: ff, color: WB.slate }}
      >
        Možnosti Vividboardu
      </p>
      <div className="relative w-full overflow-hidden bg-white flex justify-center">
        <img
          src={HERO_SLIDES[i]}
          alt=""
          className="w-[80%] max-w-full h-auto block"
          width={1206}
          height={680}
        />
        <button
          type="button"
          aria-label="Předchozí snímek"
          onClick={() => go(-1)}
          className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-[#001161]/12 shadow-md hover:bg-[#f2f6ff] flex items-center justify-center text-[#15185a]"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          type="button"
          aria-label="Další snímek"
          onClick={() => go(1)}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-[#001161]/12 shadow-md hover:bg-[#f2f6ff] flex items-center justify-center text-[#15185a]"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {HERO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Snímek ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-2 rounded-full transition-all ${idx === i ? 'w-6 bg-[#001161]' : 'w-2 bg-[#001161]/25 hover:bg-[#001161]/40'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function VividboardPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-white"
    >
      <SEOHead
        title="Vividboard"
        path="/vividboard"
        description="Připojte studenty do Vividboardu — z pasivních prezentací otázky, hlasování, testy a soutěže. Interaktivní tabule pro školy."
        image={`${SITE_URL}/vividboard/vividboard-materialy-kazdy.webp`}
        imageAlt="Vividboard — ukázka rozhraní pro interaktivní výuku"
      />

      {/* Hero — světle modré pozadí; karusel na plnou šířku sloupce (bez stínu) */}
      <div className="border-b border-[#001161]/8 bg-gradient-to-b from-[#e9f0ff] via-[#f2f6ff] to-white pt-8 md:pt-12 pb-10 md:pb-12 text-center">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 md:px-12">
          <img src={`${VB}/vividboard-logo.svg`} alt="Vividboard" className="h-9 md:h-11 w-auto mx-auto mb-6 md:mb-8" />
          <h1 className={`${cooper} text-[#001161] text-[34px] sm:text-[40px] md:text-[48px] leading-[1.05] mb-4 max-w-[760px] mx-auto tracking-tight`}>
            Připojte studenty do Vividboardu, a vaše prezentace ožije.
          </h1>
          <p
            className="text-[#4e5871] text-[16px] md:text-[17px] max-w-[520px] mx-auto leading-relaxed mb-8 md:mb-10"
            style={{ fontFamily: ff }}
          >
            Z pasivních prezentací vytvořte aktivity pro studenty: otázky, hlasování, testy a soutěže.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10 md:mb-12">
            <BtnPrimary href="https://app.vividboard.cz/" external>
              Vyzkoušet zdarma
              <ExternalLink className="w-4 h-4 opacity-90" />
            </BtnPrimary>
            <BtnDarkBlue href="/kontakt">
              Domluvit konzultaci
              <ArrowRight className="w-4 h-4" />
            </BtnDarkBlue>
          </div>
        </div>

        <HeroSlider />

        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 md:px-12 mt-8 md:mt-10 flex justify-center">
          <a
            href={VIDEO_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-bold text-[15px] hover:underline"
            style={{ fontFamily: ff, color: WB.blue }}
          >
            <Play className="w-5 h-5 shrink-0" strokeWidth={2} />
            Jak používat Vividboard
          </a>
        </div>
      </div>

      {/* Co dnes vytvoříte — pastelové karty jako na webu */}
      <SectionShell>
        <h2 className={`${cooper} text-[#001161] text-[28px] md:text-[38px] text-center mb-4 md:mb-6`}>
          Co dnes vytvoříte vy?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {CREATION_CARDS.map(({ image, label, href, variant }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`group rounded-[24px] overflow-hidden flex flex-col shadow-[0_4px_24px_rgba(0,17,97,0.08)] transition-transform duration-200 hover:scale-[1.04] hover:shadow-[0_8px_32px_rgba(0,17,97,0.12)] text-left ${WB.card[variant]}`}
            >
              <h3
                className="px-5 pt-5 pb-2 font-bold text-[16px] md:text-[17px] leading-snug min-h-[4.5rem] flex items-center"
                style={{ fontFamily: ff }}
              >
                {label}
              </h3>
              <div className="px-4 pb-5 flex justify-center flex-1 items-end bg-black/[0.03]">
                <img
                  src={image}
                  alt=""
                  className="w-[212px] h-auto max-w-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </a>
          ))}
        </div>
        <div className="text-center mt-10 md:mt-12">
          <BtnDarkBlue href="https://app.vividboard.cz/" external>
            Začít tvořit
            <ExternalLink className="w-4 h-4" />
          </BtnDarkBlue>
        </div>
      </SectionShell>

      {/* Středobod */}
      <SectionShell className="bg-[#f5f7fb]">
        <h2 className={`${cooper} text-[#001161] text-[26px] md:text-[34px] text-center mb-3`}>
          Středobod interaktivní výuky
        </h2>
        <p className="text-[#4e5871] text-[15px] md:text-[16px] max-w-[560px] mx-auto text-center leading-relaxed mb-10" style={{ fontFamily: ff }}>
          Vividboard propojí všechny vaše oblíbené nástroje a webové služby do jednoho intuitivního prostředí.
        </p>
        <div className="rounded-2xl overflow-hidden border border-[#001161]/8 bg-white shadow-[0_8px_24px_rgba(0,17,97,0.06)]">
          <img
            src={`${VB}/stredobod-hub.avif`}
            alt="Přehled propojení nástrojů ve Vividboardu"
            className="w-full h-auto block"
            loading="lazy"
            decoding="async"
          />
        </div>
      </SectionShell>

      {/* Inspirace — šedý rounded blok */}
      <SectionShell>
        <h2 className={`${cooper} text-[#001161] text-[28px] md:text-[38px] text-center mb-10 md:mb-12`}>
          Nechte se inspirovat
        </h2>
        <div className="rounded-[24px] bg-[#dee4f1] px-6 py-10 md:px-12 md:py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-10 md:gap-x-16 gap-y-10">
            {INSPIRATION.map((block) => (
              <div key={block.title}>
                <h3
                  className="text-[#4e5871] font-bold text-[17px] mb-4 min-h-[3rem] flex items-center leading-[1.25]"
                  style={{ fontFamily: `'Cooper_Light', Georgia, serif` }}
                >
                  {block.title}
                </h3>
                <ul className="space-y-3">
                  {block.items.map((row) => (
                    <li key={row.label}>
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[14px] font-semibold inline-flex items-start gap-1.5 leading-snug hover:underline"
                        style={{ fontFamily: ff, color: WB.blue }}
                      >
                        {row.label}
                        <ExternalLink className="w-3.5 h-3.5 opacity-70 shrink-0 mt-0.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      {/* 3 kroky */}
      <SectionShell className="bg-white">
        <h2 className={`${cooper} text-[#001161] text-[28px] md:text-[38px] text-center mb-12`}>
          Začněte ve třech krocích
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {THREE_STEPS.map((s) => (
            <div
              key={s.title}
              className="rounded-[24px] border border-[#001161]/8 bg-white overflow-hidden shadow-[0_6px_0_#b7bed2] flex flex-col"
            >
              <div className="bg-[#f0f2f8] p-6 flex items-center justify-center min-h-[200px]">
                <img src={s.image} alt="" className="max-h-[200px] w-auto object-contain" loading="lazy" decoding="async" />
              </div>
              <div className="p-6 md:p-7 flex-1 flex flex-col">
                <h3 className="text-[#001161] font-bold text-[17px] md:text-[18px] mb-3 leading-snug" style={{ fontFamily: ff }}>
                  {s.title}
                </h3>
                <p className="text-[#4e5871] text-[14px] leading-relaxed flex-1" style={{ fontFamily: ff }}>
                  {s.text}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10 md:mt-12">
          <BtnDarkBlue href="https://app.vividboard.cz/" external>
            Začít tvořit
            <ExternalLink className="w-4 h-4" />
          </BtnDarkBlue>
        </div>
      </SectionShell>

      {/* Vytvořit materiály… */}
      <SectionShell className="bg-[#f5f7fb] text-center">
        <h2 className={`${cooper} text-[#001161] text-[24px] md:text-[32px] mb-8 md:mb-10 max-w-[560px] mx-auto leading-tight`}>
          Vytvořit materiály ve Vividboard zvládne každý!
        </h2>
        <div className="max-w-[920px] mx-auto rounded-2xl overflow-hidden border border-[#001161]/10 shadow-[0_20px_50px_-20px_rgba(0,17,97,0.18)] bg-white">
          <img
            src={`${VB}/vividboard-materialy-kazdy.webp`}
            alt="Editor a rozhraní Vividboard"
            className="w-full h-auto block"
            width={1600}
            height={900}
            loading="lazy"
            decoding="async"
          />
        </div>
      </SectionShell>

      {/* AI — .rounded-block.vb-vedomosti: tmavě šedé #4e5871 */}
      <section className="px-5 sm:px-8 md:px-12 py-14 md:py-[4.5rem] bg-[#4e5871] text-white">
        <div className="max-w-[1080px] mx-auto flex flex-col md:flex-row md:items-stretch gap-8 md:gap-10">
          <div className="md:w-[48%] shrink-0 rounded-2xl overflow-hidden border border-white/15 shadow-lg">
            <img
              src={`${VB}/ai-unlock.webp`}
              alt=""
              className="w-full h-full object-cover min-h-[220px]"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="md:w-[52%] flex flex-col justify-center text-left md:pl-2">
            <h2 className={`${cooper} text-[26px] md:text-[32px] leading-[1.15] mb-6 text-white`}>
              Vědomosti odemčeny.
              <br />
              AI asistent je vám
              <br />
              k dispozici!
            </h2>
            <p className="text-white/90 text-[15px] md:text-[16px] leading-relaxed" style={{ fontFamily: ff }}>
              Využijte služeb umělé inteligence integrované do Vividboardu. Pomůže vám sestavit prezentace, testy nebo napsat slovní hodnocení pro vaše studenty.
            </p>
          </div>
        </div>
      </section>

      {/* Detailní analýza */}
      <SectionShell>
        <h2 className={`${cooper} text-[#001161] text-[22px] md:text-[28px] text-center mb-8 max-w-[640px] mx-auto leading-snug`}>
          Detailní analýza výsledků a pomoc s hodnocením od AI.
        </h2>
        <div className="max-w-[920px] mx-auto rounded-2xl overflow-hidden border border-[#001161]/10 shadow-[0_8px_24px_rgba(0,17,97,0.08)] mb-8">
          <img
            src={`${VB}/ai-grading.webp`}
            alt="Analýza výsledků a hodnocení pomocí AI"
            className="w-full h-auto block"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="flex justify-center">
          <a
            href={VIDEO_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-bold text-[15px] hover:underline"
            style={{ fontFamily: ff, color: WB.blue }}
          >
            <Play className="w-5 h-5 shrink-0" strokeWidth={2} />
            Jak používat Vividboard
          </a>
        </div>
      </SectionShell>

      {/* Ceník — stín jako vb-cenik-item */}
      <SectionShell className="bg-[#f5f7fb]" id="cenik">
        <h2 className={`${cooper} text-[#001161] text-[28px] md:text-[38px] text-center mb-10 md:mb-12`}>
          Ceník
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {[
            {
              name: 'Zdarma',
              price: 'Zdarma navždy',
              bullets: ['5 boardů', '10 MB úložiště', 'Limit AI'],
              cta: 'Zaregistrovat',
              href: 'https://app.vividboard.cz/',
            },
            {
              name: 'Učitel',
              price: 'od 149 Kč / měsíc',
              bullets: ['Neomezeně boardů', '300 MB', 'Pokročilý limit AI'],
              cta: 'Koupit pro jednotlivce',
              link: '/kontakt',
              internal: true,
            },
            {
              name: 'Celá škola',
              price: '8 995 Kč (Vividbooks) / 17 990 Kč',
              bullets: ['Neomezeně boardů', '300 MB', 'Účty učitelů i žáků', 'DVPP zaškolení v ceně'],
              cta: 'Koupit pro školu',
              link: '/kontakt',
              internal: true,
            },
            {
              name: 'Společnost',
              price: 'Individuálně',
              bullets: ['Neomezeně boardů a tříd', 'Extra AI', 'Firemní design', 'Soukromé materiály'],
              cta: 'Poptat',
              link: '/kontakt',
              internal: true,
            },
          ].map((card) => (
            <div
              key={card.name}
              className="rounded-[24px] bg-white p-6 md:p-7 flex flex-col shadow-[0_6px_0_#b7bed2] border border-[#001161]/8"
            >
              <h3 className="text-[#001161] font-bold text-[18px] mb-1" style={{ fontFamily: ff }}>
                {card.name}
              </h3>
              <p className="text-[#ff184a] font-bold text-[15px] mb-4" style={{ fontFamily: ff }}>
                {card.price}
              </p>
              <ul className="text-[13px] text-[#4e5871] space-y-2 mb-6 flex-1" style={{ fontFamily: ff }}>
                {card.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-[#001161]/35">•</span>
                    {b}
                  </li>
                ))}
              </ul>
              {'internal' in card && card.internal && 'link' in card ? (
                <Link
                  to={card.link!}
                  className="mt-auto inline-flex justify-center items-center min-h-[44px] rounded-md bg-[#001161] text-white font-bold text-[13px] px-4 hover:opacity-95"
                  style={{ fontFamily: ff }}
                >
                  {card.cta}
                </Link>
              ) : (
                <a
                  href={(card as { href: string }).href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex justify-center items-center gap-1 min-h-[44px] rounded-md bg-[#001161] text-white font-bold text-[13px] px-4 hover:opacity-95"
                  style={{ fontFamily: ff }}
                >
                  {card.cta}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-[12px] text-[#4e5871] mt-6 opacity-90 max-w-[640px] mx-auto" style={{ fontFamily: ff }}>
          Kompletní podmínky a aktuální ceny najdete na{' '}
          <a
            href={`${SITE_URL}/cs/vividboard#cenik`}
            className="font-semibold hover:underline"
            style={{ color: WB.blue }}
            target="_blank"
            rel="noopener noreferrer"
          >
            vividbooks.com
          </a>
          .
        </p>
      </SectionShell>

      {/* Nástroje */}
      <SectionShell className="bg-[#dee4f1]/40">
        <h2 className={`${cooper} text-[#001161] text-[28px] md:text-[38px] text-center mb-10 md:mb-12`}>
          Šest nástrojů, které budete milovat
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {TOOLS.map(({ image, title, text }) => (
            <div
              key={title}
              className="rounded-[24px] bg-white border border-[#001161]/8 overflow-hidden shadow-[0_4px_14px_rgba(0,17,97,0.06)]"
            >
              <div className="aspect-[16/10] bg-[#f5f7fb] border-b border-[#001161]/6">
                <img
                  src={image}
                  alt=""
                  className="w-full h-full object-contain object-center p-3"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="p-5 md:p-6">
                <h3 className="text-[#001161] font-bold text-[16px] mb-2" style={{ fontFamily: ff }}>
                  {title}
                </h3>
                <p className="text-[#4e5871] text-[13px] leading-relaxed" style={{ fontFamily: ff }}>
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          <a
            href="https://go.vividboard.cz/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-bold text-[14px] text-[#001161] hover:underline"
            style={{ fontFamily: ff }}
          >
            Připojit do relace
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={`${SITE_URL}/cs/vividboard/nastroje`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-bold text-[14px] hover:underline"
            style={{ fontFamily: ff, color: WB.blue }}
          >
            Zobrazit více nástrojů
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </SectionShell>

      <section className="px-5 sm:px-8 md:px-12 py-12 text-center border-t border-[#001161]/10 bg-white">
        <p className="text-[#4e5871] text-[14px] mb-4" style={{ fontFamily: ff }}>
          Video: Jak používat Vividboard
        </p>
        <a
          href={VIDEO_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[#001161] font-bold text-[15px] hover:underline"
          style={{ fontFamily: ff }}
        >
          Přehrát návod
          <ExternalLink className="w-4 h-4" />
        </a>
      </section>
    </motion.div>
  );
}
