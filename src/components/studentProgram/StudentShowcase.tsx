/**
 * Ukázkové sekce microsite /studenti: hero s řadou obálek, předměty s obálkami
 * sešitů, co v aplikaci je (slider SubjectTabsSection jako na stránkách předmětů) a jak s tím
 * pracovat na praxi. Obrázky: obálky ze Supabase Storage (náhled přes
 * render/image), snímky obsahu z CDN webu (stejné jako záložky na stránkách předmětů)
 * a z public/.
 */
import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { SubjectTabsSection, type SubjectExtraTab } from '../SubjectTabsSection';
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

/* ── Hero: centrovaný text, pod ním řada obálek všech předmětů ─────────────── */

const HERO_ROW = [
  { file: '1773603310291-vxkn17dwtg.png', alt: 'Matematika 1' },
  { file: '1773603917284-gkt509tga48.png', alt: 'Prvouka 1' },
  { file: '1773606281525-ufa9y7sb809.png', alt: 'Písanka' },
  { file: '1773602692548-4x43oehi9im.webp', alt: 'Matematika 6' },
  { file: '1773586787125-suqqssqwjco.webp', alt: 'Fyzika 6' },
  { file: '1773603212736-omtxsa1ce8c.webp', alt: 'Přírodopis 6' },
  { file: '1773602656594-qszbmfqb75l.webp', alt: 'Chemie 8' },
];

export function StudentHero({ onCta, secondaryHref }: { onCta: () => void; secondaryHref: string }) {
  const mid = (HERO_ROW.length - 1) / 2;
  return (
    <section className="mx-auto max-w-[1100px] text-center">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="mx-auto mb-5 max-w-[900px] font-['Cooper_Light',serif] text-[34px] leading-[1.08] text-[#001161] md:text-[54px]">
          Pro studenty učitelství: Vividbooks zdarma po celou dobu studia.
        </h1>
        <p style={FF} className="mx-auto mb-8 max-w-[640px] text-[16px] leading-relaxed text-[#001161]/65 md:text-[18px]">
          Interaktivní lekce, animace, pracovní listy a testy pro matematiku, fyziku, chemii, přírodopis, prvouku i češtinu — stejné, se kterými učí přes 600 základních škol. Stačí univerzitní e-mail.
        </p>
        <div className="flex flex-col flex-wrap items-center justify-center gap-3 sm:flex-row">
          <button type="button" onClick={onCta} className="inline-flex h-[53px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-[15px] bg-[#7C3AED] px-[31px] text-[15px] font-bold text-white transition-all hover:scale-[1.03] hover:bg-[#6D28D9]" style={FF}>
            Získat přístup zdarma <ArrowRight className="h-4 w-4" />
          </button>
          <a href={secondaryHref} className="inline-flex h-[53px] items-center gap-2 whitespace-nowrap rounded-[15px] border border-[#001161]/12 bg-white px-[31px] text-[15px] font-bold text-[#001161] no-underline transition-all hover:bg-[#f5f7fd]" style={FF}>
            Co v aplikaci najdete
          </a>
        </div>
        <p style={FF} className="mt-5 text-[12px] text-[#001161]/45">Bez karty · bez závazku · obnovení jedním kliknutím každý rok</p>
      </motion.div>
      <div className="relative mt-12 overflow-hidden rounded-[32px] bg-[#f5f7fd] px-4 pt-10">
        <div className="flex items-end justify-center gap-3 md:gap-5">
          {HERO_ROW.map((c, i) => {
            const d = Math.abs(i - mid);
            return (
              <motion.img
                key={c.file}
                src={cover(c.file)}
                alt={`Pracovní sešit ${c.alt}`}
                loading="eager"
                decoding="async"
                onError={hideBroken}
                className={`w-[18%] max-w-[130px] rounded-t-[6px] object-cover shadow-[0_12px_30px_rgba(0,17,97,0.18)] ${d > 2 ? 'hidden sm:block' : ''}`}
                style={{ aspectRatio: '0.71', marginBottom: `${-d * 18}px` }}
                initial={{ opacity: 0, y: 40, rotate: 0 }}
                animate={{ opacity: 1, y: 0, rotate: (i - mid) * 2.5 }}
                transition={{ duration: 0.5, delay: 0.15 + d * 0.08 }}
              />
            );
          })}
        </div>
      </div>
    </section>
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

/* ── Co v aplikaci najdete: stejný slider jako na stránkách předmětů ───────── */

const MATERIAL_TABS: SubjectExtraTab[] = [
  {
    id: 'lekce',
    tabText: 'Interaktivní lekce',
    contentHeadline: 'Hotová hodina krok za krokem',
    contentRichText: 'Otázka na začátek, výklad s obrázky, diskuze a shrnutí. Stačí promítnout na tabuli — a ke každé lekci metodická inspirace pro učitele.',
    contentImage: `${CDN}68d92aab56eecbedf1e81d7d_rectangle_2806_4x.webp`,
    bgColor: '#fff3dc',
    order: 1,
  },
  {
    id: 'animace',
    tabText: 'Animace a 3D modely',
    contentHeadline: 'Jevy, které se na tabuli špatně kreslí',
    contentRichText: 'Animace a pokusy ve fyzice a chemii, 3D modely v přírodopisu, které žáci otočí ze všech stran.',
    contentImage: `${CDN}68dab0083048880f302a15b3_rectangle_2823_4x.webp`,
    bgColor: '#edf7ed',
    order: 2,
  },
  {
    id: 'listy',
    tabText: 'Pracovní listy a texty',
    contentHeadline: 'Pracovní listy a učební texty',
    contentRichText: 'Listy k tisku i k vyplnění na tabletu, učební texty ke každé kapitole a badatelské listy k pokusům.',
    contentImage: `${CDN}68d92b2d13fa972edb64d5bd_rectangle_2808_4x.webp`,
    bgColor: '#f3edf7',
    order: 3,
  },
  {
    id: 'testy',
    tabText: 'Testy a písemky',
    contentHeadline: 'Testy, písemky a kvízy',
    contentRichText: 'Připravené písemky k tisku i online testy, které se vyhodnotí samy. Vyzkoušíte si, jak rychle zjistit, co třída pochopila.',
    contentImage: `${CDN}68d92bf1ae29b34fe565b73d_rectangle_2807_4x.webp`,
    bgColor: '#e8f0fb',
    order: 4,
  },
  {
    id: 'vividboard',
    tabText: 'Vividboard',
    contentHeadline: 'Aktivity se třídou',
    contentRichText: 'Hlasování, soutěžní kvízy a interaktivní prezentace. Žáci se připojí kódem ze svých zařízení a vy vidíte odpovědi hned.',
    contentImage: '/aplikace/news-06-vividboard.png',
    contentImageFit: 'contain',
    bgColor: '#f5f0ff',
    order: 5,
  },
  {
    id: 'aplikace',
    tabText: 'Matematické aplikace',
    contentHeadline: 'Matematiku uvidí, ne jen spočítají',
    contentRichText: 'Tělesa ve 3D, zlomky, algebraické dlaždice a rýsování — interaktivní pomůcky pro výuku matematiky.',
    contentImage: aplikace3dObjekty,
    contentImageFit: 'contain',
    bgColor: '#dbe7fa',
    order: 6,
  },
  {
    id: 'tvorba',
    tabText: 'Vlastní materiály',
    contentHeadline: 'Vlastní hodina i materiál na seminář',
    contentRichText: 'Upravte hotový list, složte si vlastní hodinu nebo připravte materiál na seminář. Editor dokumentů, pracovních listů a AI pomocník.',
    contentImage: `${CDN}68d92c355a60001dd4ccba45_rectangle_2810_4x.webp`,
    bgColor: '#fff0e0',
    order: 7,
  },
];

export function StudentMaterialsSection() {
  return (
    <section className="-mx-4 mb-20">
      <SubjectTabsSection subject="Studenti" displayName="aplikace" light staticTabs={MATERIAL_TABS} sectionHeading="Co v aplikaci najdete" />
    </section>
  );
}
