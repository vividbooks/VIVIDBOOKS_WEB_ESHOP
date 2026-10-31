import React from 'react';
import { SubjectTabsSection } from './SubjectTabsSection';
import { MathVoicedVideos } from './MathInteractiveIncluded';
import { MATH2_ECOSYSTEM_EXCLUDED_TABS } from './MathCampaignLandingPage';
import { MATEMATIKA_2_TAB_OVERRIDES } from '../data/matematika2SubjectTabOverrides';
import imgPracovniListy from '../assets/campaign/pracovni-listy-ukazka.webp';
import { formatTypography } from '../utils/formatTypography';

/**
 * Pod listováním sešitu matematiky: stejná sekce jako na pilotáži (/matematika-pilotovani) —
 * co v aplikaci najdete (záložky), jak to vypadá v hodině (namluvená videa) a další aplikace.
 */

const FF = "'Fenomen Sans', sans-serif";
const APP_ORIGIN = 'https://nove.vividbooks.com';
const APP_ICON_STORAGE = 'https://qypiuvqglsmxdsnyazih.supabase.co/storage/v1/object/public/platform-admin/covers';

type MathApp = { name: string; body: string; icon: string; stage: '1. stupeň' | '2. stupeň' | '9. ročník' };

/** Aplikace k matematice v knihovně (stejný výčet jako pilotáž, stav k 16. 10. 2026). */
const MATH_APPS: MathApp[] = [
  { name: 'Početník', body: 'Generuje příklady k procvičení počítání. Nastavíte téma a obtížnost, žáci počítají na tabletu nebo z tisku.', icon: `${APP_ORIGIN}/assets/applications/pocetnik-icon-stupen-2.png`, stage: '2. stupeň' },
  { name: 'Slovní úlohy', body: 'Slovní úlohy po krocích: žák si úlohu rozebere, zapíše a vyřeší.', icon: `${APP_ORIGIN}/assets/applications/slovni-ulohy-icon.svg`, stage: '2. stupeň' },
  { name: 'Přijímací zkoušky', body: 'Úlohy z přijímaček CERMAT po tématech i celé testy nanečisto.', icon: `${APP_ORIGIN}/assets/applications/prijimacky-icon.svg`, stage: '9. ročník' },
  { name: 'Funkce a grafy', body: 'Grafy funkcí, které se mění podle toho, jak žák posouvá parametry. Ideální na tabuli.', icon: `${APP_ORIGIN}/assets/applications/graf-icon.svg`, stage: '2. stupeň' },
  { name: 'Rýsování', body: 'Konstrukce krok za krokem: pravítko, kružítko a úhloměr na tabuli i záznamy, jak se úloha rýsuje.', icon: `${APP_ICON_STORAGE}/application-icon-dc5ff97a-9285-4ec6-9ca3-1a5534ba2af6-1789647779730.svg`, stage: '2. stupeň' },
  { name: 'Rovinné útvary a tělesa', body: 'Tělesa, která žáci otáčejí, rozkládají do sítě a počítají jejich povrch a objem.', icon: `${APP_ICON_STORAGE}/application-icon-4f9ee394-f5f9-4e9c-aeb0-25770cc3307f-1787307334254.svg`, stage: '2. stupeň' },
  { name: 'Zlomky', body: 'Zlomky názorně: zobrazit, porovnat, rozšířit a procvičit v jednoduchých aktivitách.', icon: `${APP_ICON_STORAGE}/application-icon-f8ffe4b0-4095-4214-bbe8-f3ab8bb3271e-1787307343854.svg`, stage: '2. stupeň' },
  { name: 'Algebraické dlaždice', body: 'Výrazy a rovnice jako tvary, které žáci skládají a odebírají. Úpravy výrazů pochopí, ne nabiflují.', icon: `${APP_ICON_STORAGE}/application-icon-d1311fe1-94f2-4dae-95b8-141428239974-1787307354294.svg`, stage: '2. stupeň' },
  { name: 'Matematické minihry', body: 'Krátké hry k úlohám z pracovních sešitů pro nejmenší. Procvičování, které děti baví.', icon: `${APP_ICON_STORAGE}/application-icon-new-1781271135863.svg`, stage: '1. stupeň' },
];

/** Aplikace, které mají své video v přehrávači výše — v seznamu se neopakují. */
const APPS_IN_VIDEOS = new Set(['Početník', 'Slovní úlohy', 'Přijímací zkoušky', 'Rýsování']);

const TAB_OVERRIDES_2ND = {
  ...MATEMATIKA_2_TAB_OVERRIDES,
  'Bousové kapitoly a úlohy': { tabText: 'Bonusové kapitoly a úlohy' },
  'Bousové kapitoly a úlohy': { tabText: 'Bonusové kapitoly a úlohy' },
  'Interaktivní pracovní listy s řešením': { order: 0, contentImage: imgPracovniListy, contentImageFit: 'contain' as const },
};
const EXCLUDED_TABS_2ND = [...MATH2_ECOSYSTEM_EXCLUDED_TABS, 'Aplikace Rýsování'];

/** Výchozí texty platí pro detail sešitu; stránka předmětu posílá vlastní (bez řeči o sešitu). */
export function MathAppShowcase({
  secondStage,
  intro = 'Učebnice, pracovní listy, procvičování a aplikace v jednom prostředí. Ke třídní objednávce od 15 sešitů je v ceně.',
  videosBody = 'Krátká videa se zvukem: co k sešitu dostanete a jak s tím pracujete v hodině.',
}: {
  secondStage: boolean;
  intro?: string;
  videosBody?: string;
}) {
  const apps = MATH_APPS.filter((a) => (secondStage ? a.stage !== '1. stupeň' : a.stage === '1. stupeň')).filter(
    (a) => !(secondStage && APPS_IN_VIDEOS.has(a.name)),
  );
  return (
    <section id="co-v-aplikaci" className="scroll-mt-24 px-4 pt-16 pb-16 sm:px-6 md:pb-24">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-[30px] font-bold leading-tight tracking-[-0.01em] text-[#001161] md:text-[38px]" style={{ fontFamily: FF }}>
          {formatTypography('Co všechno v aplikaci najdete')}
        </h2>
        <p className="mt-2 mb-6 max-w-[640px] text-[15px] leading-relaxed text-[#001161]/60" style={{ fontFamily: FF }}>
          {formatTypography(intro)}
        </p>
        <div className="overflow-hidden rounded-[28px]">
          <SubjectTabsSection
            subject={secondStage ? 'Matematika 2. stupeň' : 'Matematika 1. stupeň'}
            displayName="Matematika"
            light
            hideSectionHeading
            excludeTabTexts={secondStage ? EXCLUDED_TABS_2ND : MATH2_ECOSYSTEM_EXCLUDED_TABS}
            tabOverrides={secondStage ? TAB_OVERRIDES_2ND : undefined}
          />
        </div>

        <MathVoicedVideos
          secondStage={secondStage}
          sansTitle
          controls
          className="mt-14 !px-0"
          title="Jak to vypadá v hodině"
          body={videosBody}
        />

        {apps.length > 0 && (
          <>
            <p className="mt-8 text-[14px] font-bold text-[#001161]/45" style={{ fontFamily: FF }}>
              {formatTypography('A k tomu další aplikace k matematice')}
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((app) => (
                <li key={app.name} className="flex gap-4 rounded-[20px] bg-[#f8f9fc] p-4 ring-1 ring-[#001161]/6">
                  <img src={app.icon} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-[14px] object-cover shadow-sm" />
                  <div className="min-w-0" style={{ fontFamily: FF }}>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[16px] font-bold text-[#001161]">{app.name}</span>
                      <span className="text-[12px] font-bold text-[#001161]/40">{app.stage}</span>
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-[#001161]/62">{formatTypography(app.body)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
