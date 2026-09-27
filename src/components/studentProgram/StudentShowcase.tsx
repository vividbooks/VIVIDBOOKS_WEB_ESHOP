/**
 * Ukázkové sekce microsite /studenti: předměty s obálkami sešitů, co v aplikaci je
 * (lekce, animace a 3D, pracovní listy, testy, vividboard, aplikace, vlastní materiály)
 * a jak s tím pracovat na praxi. Obrázky: obálky ze Supabase Storage (náhled přes
 * render/image), snímky obsahu z CDN webu (stejné jako záložky na stránkách předmětů)
 * a z public/.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Presentation, Atom, FileText, ClipboardCheck, Sparkles, Shapes, PenTool, GraduationCap, MonitorPlay, Users, BookOpenCheck,
} from 'lucide-react';
import { supabasePublicUrlToTinyRenderUrl } from '../../utils/supabaseImageThumbnail';
import aplikace3dObjekty from '../../assets/campaign/aplikace-3d-objekty.png';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const COVERS = 'https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/make-93a20b6f-images/';
const CDN = 'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/';

function cover(file: string): string {
  const url = COVERS + file;
  return supabasePublicUrlToTinyRenderUrl(url, { width: 320, quality: 75 }) || url;
}

function hideBroken(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = 'hidden';
}

/* ── Hero: tablet s lekcí a pár obálek ─────────────────────────────────────── */

const HERO_COVERS = [
  { src: cover('1773586787125-suqqssqwjco.webp'), alt: 'Fyzika 6', className: 'left-[2%] top-[8%] -rotate-[9deg]' },
  { src: cover('1773603212736-omtxsa1ce8c.webp'), alt: 'Přírodopis 6', className: 'right-[1%] top-[2%] rotate-[7deg]' },
  { src: cover('1773603917284-gkt509tga48.png'), alt: 'Prvouka 1', className: 'right-[6%] bottom-[2%] rotate-[4deg]' },
];

export function StudentHeroVisual() {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[520px]">
      <div className="absolute inset-[8%] rounded-[40px] bg-gradient-to-br from-[#E8942A]/15 via-[#7C3AED]/10 to-[#10b981]/15 blur-2xl" aria-hidden />
      <motion.img
        src="/app-screenshots/nova-1.png"
        alt="Interaktivní lekce Vividbooks na tabletu"
        className="absolute inset-x-[6%] top-[10%] w-[88%] drop-shadow-xl"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        onError={hideBroken}
      />
      {HERO_COVERS.map((c, i) => (
        <motion.img
          key={c.alt}
          src={c.src}
          alt={`Pracovní sešit ${c.alt}`}
          loading="eager"
          className={`absolute w-[22%] rounded-md shadow-[0_10px_30px_rgba(0,17,97,0.22)] ${c.className}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25 + i * 0.12 }}
          onError={hideBroken}
        />
      ))}
    </div>
  );
}

/* ── Předměty ─────────────────────────────────────────────────────────────── */

type SubjectCard = {
  name: string;
  grades: string;
  bg: string;
  accent: string;
  covers: string[];
  items: string[];
};

const SUBJECTS: SubjectCard[] = [
  {
    name: 'Matematika',
    grades: '1. stupeň',
    bg: '#e8f0fb',
    accent: '#4a7fd4',
    covers: [cover('1773603310291-vxkn17dwtg.png'), cover('1780300513332-wl6xzz1kwm.png'), cover('1773605786058-c3ux3qrfnun.png')],
    items: ['pracovní učebnice', 'procvičování', 'matematická tabule', 'pomůcky'],
  },
  {
    name: 'Matematika',
    grades: '2. stupeň · 6.–9. ročník',
    bg: '#dbe7fa',
    accent: '#2f5fb3',
    covers: [cover('1773602692548-4x43oehi9im.webp'), cover('1773602929444-i08decrif2n.png'), cover('1773602733653-gsik4c18tv.webp')],
    items: ['sešity a učební texty', 'procvičování', 'testy a písemky', 'aplikace na zlomky a 3D'],
  },
  {
    name: 'Fyzika',
    grades: '6.–9. ročník',
    bg: '#fff3dc',
    accent: '#e08000',
    covers: [cover('1773586787125-suqqssqwjco.webp'), cover('1773586768843-3fmj5ahz8u1.webp'), cover('1773586800379-zj09nlv0jif.webp')],
    items: ['lekce s animacemi', 'pracovní listy', 'učební texty', 'testy'],
  },
  {
    name: 'Chemie',
    grades: '8.–9. ročník',
    bg: '#f3edf7',
    accent: '#7b2d8b',
    covers: [cover('1773602656594-qszbmfqb75l.webp'), cover('1773602639840-hi20gqzmunb.webp')],
    items: ['lekce', 'badatelské listy', 'učební texty', 'testy'],
  },
  {
    name: 'Přírodopis',
    grades: '6.–9. ročník',
    bg: '#edf7ed',
    accent: '#2e7d32',
    covers: [cover('1773603212736-omtxsa1ce8c.webp'), cover('1773603196742-5gromuri6y.webp'), cover('1773603182827-b2ts26o1fue.webp')],
    items: ['lekce', '3D modely', 'pracovní listy', 'testy'],
  },
  {
    name: 'Prvouka',
    grades: '1. stupeň',
    bg: '#fff0e0',
    accent: '#e65100',
    covers: [cover('1773603917284-gkt509tga48.png'), cover('1773603849285-j6vryl5bewe.jpg')],
    items: ['pracovní učebnice', 'učení venku', 'projektové učení', 'metodiky'],
  },
  {
    name: 'Český jazyk',
    grades: '1. stupeň',
    bg: '#fef9e0',
    accent: '#a08000',
    covers: [cover('1773606281525-ufa9y7sb809.png'), cover('1773606385447-m4fpz9o3y9m.png')],
    items: ['písanky', 'pracovní listy'],
  },
];

function CoverFan({ covers, name }: { covers: string[]; name: string }) {
  const n = covers.length;
  return (
    <div className="relative mx-auto h-[150px] w-full max-w-[260px]">
      {covers.map((src, i) => {
        const offset = i - (n - 1) / 2;
        const spread = n > 2 ? 58 : 64;
        return (
          <img
            key={src}
            src={src}
            alt={`${name} — obálka ${i + 1}`}
            loading="lazy"
            decoding="async"
            onError={hideBroken}
            className="absolute left-1/2 top-2 h-[124px] w-auto rounded-[4px] shadow-[0_8px_20px_rgba(0,17,97,0.18)]"
            style={{ transform: `translateX(calc(-50% + ${offset * spread}px)) rotate(${offset * 6}deg)`, zIndex: 10 - Math.abs(Math.round(offset * 2)) }}
          />
        );
      })}
    </div>
  );
}

export function StudentSubjectsSection() {
  return (
    <section className="mx-auto mb-20 max-w-[1040px]">
      <div className="mb-8 text-center">
        <p style={FF} className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#B45309]">Všechno v jednom přístupu</p>
        <h2 className="font-['Cooper_Light',serif] text-[28px] leading-tight text-[#001161] md:text-[36px]">Předměty pro 1. i 2. stupeň</h2>
        <p style={FF} className="mx-auto mt-3 max-w-[620px] text-[15px] leading-relaxed text-[#001161]/65">
          Studentský přístup odemyká interaktivní obsah všech předmětů — ať učíte na praxi prvňáky, nebo deváťáky.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUBJECTS.map((s, i) => (
          <motion.div
            key={`${s.name}-${s.grades}`}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: (i % 4) * 0.06 }}
            className="group overflow-hidden rounded-[24px] border border-[#001161]/6 bg-white"
          >
            <div className="px-4 pt-4" style={{ background: s.bg }}>
              <CoverFan covers={s.covers} name={s.name} />
            </div>
            <div className="p-5">
              <p style={FF} className="text-[17px] font-bold text-[#001161]">{s.name}</p>
              <p style={{ ...FF, color: s.accent }} className="mb-3 text-[12px] font-bold uppercase tracking-wide">{s.grades}</p>
              <div className="flex flex-wrap gap-1.5">
                {s.items.map((it) => (
                  <span key={it} style={FF} className="rounded-full bg-[#001161]/5 px-2.5 py-1 text-[12px] text-[#001161]/70">{it}</span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
        <div className="flex flex-col justify-center rounded-[24px] bg-[#001161] p-6 text-white">
          <Sparkles className="mb-3 h-7 w-7 text-[#E8942A]" />
          <p style={FF} className="mb-2 text-[17px] font-bold">A k tomu nástroje</p>
          <p style={FF} className="text-[14px] leading-relaxed text-white/75">Vividboard pro aktivity a kvízy, editory pracovních listů a dokumentů, nekonečná nástěnka a AI pomocník pro přípravy.</p>
        </div>
      </div>
    </section>
  );
}

/* ── Co v aplikaci najdete ────────────────────────────────────────────────── */

type Material = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  image: string;
  imageAlt: string;
  bg: string;
};

const MATERIALS: Material[] = [
  {
    id: 'lekce',
    icon: Presentation,
    title: 'Interaktivní lekce do hodiny',
    text: 'Hotová hodina krok za krokem: otázka na začátek, výklad s obrázky, diskuze a shrnutí. Stačí promítnout na tabuli — a k tomu metodická inspirace pro učitele.',
    image: `${CDN}68d92aab56eecbedf1e81d7d_rectangle_2806_4x.webp`,
    imageAlt: 'Ukázky lekcí fyziky',
    bg: '#fff3dc',
  },
  {
    id: 'animace',
    icon: Atom,
    title: 'Animace, pokusy a 3D modely',
    text: 'Jevy, které se na tabuli špatně kreslí: animace ve fyzice a chemii, 3D modely v přírodopisu, které žáci otočí ze všech stran.',
    image: `${CDN}68dab0083048880f302a15b3_rectangle_2823_4x.webp`,
    imageAlt: '3D modely v přírodopisu',
    bg: '#edf7ed',
  },
  {
    id: 'listy',
    icon: FileText,
    title: 'Pracovní listy a učební texty',
    text: 'Listy k tisku i k vyplnění na tabletu, učební texty ke každé kapitole a badatelské listy k pokusům.',
    image: `${CDN}68d92b2d13fa972edb64d5bd_rectangle_2808_4x.webp`,
    imageAlt: 'Pracovní listy fyziky',
    bg: '#f3edf7',
  },
  {
    id: 'testy',
    icon: ClipboardCheck,
    title: 'Testy, písemky a kvízy',
    text: 'Připravené písemky k tisku i online testy, které se vyhodnotí samy. Vyzkoušíte si, jak rychle zjistit, co třída pochopila.',
    image: `${CDN}68d92bf1ae29b34fe565b73d_rectangle_2807_4x.webp`,
    imageAlt: 'Testy a výsledky žáků',
    bg: '#e8f0fb',
  },
  {
    id: 'vividboard',
    icon: MonitorPlay,
    title: 'Vividboard: aktivity se třídou',
    text: 'Hlasování, soutěžní kvízy a interaktivní prezentace. Žáci se připojí kódem ze svých zařízení a vy vidíte odpovědi hned.',
    image: '/aplikace/news-06-vividboard.png',
    imageAlt: 'Vividboard',
    bg: '#f5f0ff',
  },
  {
    id: 'aplikace',
    icon: Shapes,
    title: 'Matematické aplikace',
    text: 'Tělesa ve 3D, zlomky, algebraické dlaždice a rýsování — manipulativy, se kterými žáci matematiku uvidí, ne jen spočítají.',
    image: aplikace3dObjekty,
    imageAlt: 'Aplikace 3D objekty',
    bg: '#dbe7fa',
  },
  {
    id: 'tvorba',
    icon: PenTool,
    title: 'Vlastní materiály',
    text: 'Upravte hotový list, složte si vlastní hodinu nebo připravte materiál na seminář. Editor dokumentů, pracovních listů a AI pomocník.',
    image: `${CDN}68d92c355a60001dd4ccba45_rectangle_2810_4x.webp`,
    imageAlt: 'Tvorba vlastních materiálů',
    bg: '#fff0e0',
  },
];

export function StudentMaterialsSection() {
  const [active, setActive] = useState(MATERIALS[0].id);
  const m = MATERIALS.find((x) => x.id === active) || MATERIALS[0];
  return (
    <section className="mx-auto mb-20 max-w-[1040px]">
      <div className="mb-8 text-center">
        <p style={FF} className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#7C3AED]">Podívejte se dovnitř</p>
        <h2 className="font-['Cooper_Light',serif] text-[28px] leading-tight text-[#001161] md:text-[36px]">Co v aplikaci najdete</h2>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" role="tablist">
          {MATERIALS.map((x) => {
            const on = x.id === active;
            return (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(x.id)}
                className={`flex shrink-0 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all lg:shrink ${on ? 'border-[#7C3AED]/25 bg-white shadow-md shadow-[#7C3AED]/10' : 'border-transparent hover:bg-white/70'}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-[#7C3AED] text-white' : 'bg-[#001161]/6 text-[#001161]/60'}`}>
                  <x.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span style={FF} className={`block whitespace-nowrap text-[14px] font-bold lg:whitespace-normal ${on ? 'text-[#001161]' : 'text-[#001161]/70'}`}>{x.title}</span>
                  {on && <span style={FF} className="mt-1 hidden text-[13px] leading-relaxed text-[#001161]/65 lg:block">{x.text}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex aspect-[4/3.4] items-center justify-center overflow-hidden rounded-[28px] p-6"
              style={{ background: m.bg }}
            >
              <img src={m.image} alt={m.imageAlt} loading="lazy" decoding="async" onError={hideBroken} className="max-h-full max-w-full object-contain" />
            </motion.div>
          </AnimatePresence>
          <p style={FF} className="mt-3 text-[14px] leading-relaxed text-[#001161]/65 lg:hidden">{m.text}</p>
        </div>
      </div>
    </section>
  );
}

/* ── Na praxi i na seminář ────────────────────────────────────────────────── */

const PRACTICE = [
  { icon: BookOpenCheck, title: 'Příprava na výstup', text: 'Vyberte lekci k tématu, projděte si metodickou inspiraci a upravte si ji podle třídy.' },
  { icon: Presentation, title: 'Hodina na praxi', text: 'Promítněte lekci na tabuli, pusťte animaci a rozdejte pracovní listy — nic nechystáte od nuly.' },
  { icon: Users, title: 'Žáci na svých zařízeních', text: 'S kódem pro žáky se třída připojí ke kvízu nebo aktivitě ve vividboardu a vy hned vidíte odpovědi.' },
  { icon: GraduationCap, title: 'Seminárka i státnice', text: 'Didaktika na hotových příkladech: jak je postavená hodina, jak se ptát, jak ověřit porozumění.' },
];

export function StudentPracticeSection() {
  return (
    <section className="mx-auto mb-16 max-w-[1040px] rounded-[32px] bg-[#f5f6fa] px-5 py-10 md:px-10">
      <h2 className="mb-2 text-center font-['Cooper_Light',serif] text-[26px] leading-tight text-[#001161] md:text-[32px]">Na praxi i na seminář</h2>
      <p style={FF} className="mx-auto mb-8 max-w-[560px] text-center text-[14px] leading-relaxed text-[#001161]/60">Stejné materiály, se kterými učí přes 600 základních škol. Budete je znát dřív, než se postavíte před vlastní třídu.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRACTICE.map((p) => (
          <div key={p.title} className="rounded-[22px] bg-white p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8942A]/12">
              <p.icon className="h-5 w-5 text-[#B45309]" />
            </div>
            <p style={FF} className="mb-1 text-[15px] font-bold text-[#001161]">{p.title}</p>
            <p style={FF} className="text-[13px] leading-relaxed text-[#001161]/65">{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
