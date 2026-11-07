import React from 'react';
import { SubjectTabsSection } from './SubjectTabsSection';
import { MathVoicedVideos, type VoicedVideo } from './MathInteractiveIncluded';
import { MATH2_ECOSYSTEM_EXCLUDED_TABS } from './MathCampaignLandingPage';
import { MATEMATIKA_2_TAB_OVERRIDES } from '../data/matematika2SubjectTabOverrides';
import imgPracovniListy from '../assets/campaign/pracovni-listy-ukazka.webp';
import { formatTypography } from '../utils/formatTypography';

/**
 * Sekce na stránce předmětu (matematika 1./2. stupeň, fyzika): stejná jako na pilotáži (/matematika-pilotovani) —
 * co v aplikaci najdete (záložky), jak to vypadá v hodině (videa) a další aplikace k předmětu.
 */

const FF = "'Fenomen Sans', sans-serif";
const APP_ORIGIN = 'https://nove.vividbooks.com';
const APP_ICON_STORAGE = 'https://qypiuvqglsmxdsnyazih.supabase.co/storage/v1/object/public/platform-admin/covers';

type ShowcaseApp = {
  name: string;
  body: string;
  icon: string;
  stage: '1. stupeň' | '2. stupeň' | '9. ročník';
  /** Ikona knihovny (ne dlaždice aplikace): celá, na bílém podkladu. */
  iconContain?: boolean;
};

/** Aplikace k matematice v knihovně (stejný výčet jako pilotáž, stav k 16. 10. 2026). */
const MATH_APPS: ShowcaseApp[] = [
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

/**
 * Fyzika — videa do hodiny. Zdroje: lekce = blog „6 nástrojů…“ (YouTube), simulace = namluvená upoutávka
 * z aplikace (public/fyzika-videa), řešení = video „Řešení na nástěnce“ (ukazuje i fyziku),
 * vzorová hodina = blog „Příběh třídy, která vyrůstala s Vividbooks“ (YouTube).
 */
const FYZIKA_VIDEOS: VoicedVideo[] = [
  { file: 'lekce', youtube: 'pnW3WQyfQ_E', title: 'Interaktivní lekce', note: 'Animace, vizualizace a otevřené otázky, nad kterými třída diskutuje.', len: '0:53' },
  { file: 'simulace', dir: 'fyzika-videa', title: 'Fyzikální simulace', note: 'Pokus na tabuli, i když na něj ve třídě nemáte pomůcky. Ke každé simulaci úkoly.', len: '0:43' },
  { file: 'reseni-nastenka', title: 'Řešení na nástěnce', note: 'Úloha po úloze, řešení odkrýváte po krocích přímo na tabuli.', len: '1:02' },
  { file: 'kosmonosy', youtube: 'e59AnUsORr0', title: 'Vzorová hodina – ZŠ Kosmonosy', note: 'Marcela Červová a třída, která s Vividbooks prošla celou fyziku 2. stupně.', len: '8:31' },
];

/**
 * Aplikace k fyzice (podle Vítka 7. 11. 2026): z knihovny kategorie Fyzika (Simulace, Elektrický obvod),
 * Funkce a grafy (knihovna Matematika), Vividboard a editor pracovních listů (skill vividbooks + záložka
 * „Tvorba vlastních interaktivních materiálů“ v KV) a testy a písemky (záložka fyziky v KV).
 */
const FYZIKA_APPS: ShowcaseApp[] = [
  { name: 'Fyzikální simulace', body: 'Siloměr, páka, tlak, vztlaková síla, čočky a další pokusy na tabuli. Ke každé simulaci úkoly.', icon: `${APP_ICON_STORAGE}/application-icon-new-1781271223614.png`, stage: '2. stupeň' },
  { name: 'Elektrický obvod', body: 'Žáci sestaví obvod z baterie, žárovek, vypínačů, rezistorů a LED a měří ampérmetrem a voltmetrem.', icon: `${APP_ICON_STORAGE}/application-icon-new-1781271178864.svg`, stage: '2. stupeň' },
  { name: 'Funkce a grafy', body: 'Grafy funkcí, které se mění podle toho, jak žák posouvá parametry. Ideální na tabuli.', icon: `${APP_ORIGIN}/assets/applications/graf-icon.svg`, stage: '2. stupeň' },
  { name: 'Vividboard', body: 'Tvorba vlastních materiálů a prezentací s interaktivními aktivitami. Můžete začít z hotových materiálů a šablon Vividbooks, pomůže i umělá inteligence.', icon: `${APP_ORIGIN}/icons/library/prezentace.svg`, iconContain: true, stage: '2. stupeň' },
  { name: 'Pracovní listy', body: 'Vlastní pracovní listy v editoru: hotový list z knihovny zkopírujete a upravíte, nebo začnete od nuly. Tisk do PDF.', icon: `${APP_ORIGIN}/icons/library/worksheet.svg`, iconContain: true, stage: '2. stupeň' },
  { name: 'Testy a písemky', body: 'Vyplňování společně se žáky nebo každý svým tempem, s detailním vyhodnocením ve Vividboardu. Lze je i tisknout a upravit.', icon: `${APP_ORIGIN}/icons/library/test.svg`, iconContain: true, stage: '2. stupeň' },
];

export type ShowcaseSubject = 'matematika-1' | 'matematika-2' | 'fyzika';

/** Výchozí texty platí pro detail sešitu; stránka předmětu posílá vlastní (bez řeči o sešitu). */
export function SubjectAppShowcase({
  subject,
  intro = 'Učebnice, pracovní listy, procvičování a aplikace v jednom prostředí. Ke třídní objednávce od 15 sešitů je v ceně.',
  videosBody = 'Krátká videa se zvukem: co k sešitu dostanete a jak s tím pracujete v hodině.',
}: {
  subject: ShowcaseSubject;
  intro?: string;
  videosBody?: string;
}) {
  const secondStage = subject !== 'matematika-1';
  const fyzika = subject === 'fyzika';
  const apps = fyzika
    ? FYZIKA_APPS
    : MATH_APPS.filter((a) => (secondStage ? a.stage !== '1. stupeň' : a.stage === '1. stupeň')).filter(
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
          {fyzika ? (
            <SubjectTabsSection subject="Fyzika" displayName="Fyzika" light hideSectionHeading />
          ) : (
            <SubjectTabsSection
              subject={secondStage ? 'Matematika 2. stupeň' : 'Matematika 1. stupeň'}
              displayName="Matematika"
              light
              hideSectionHeading
              excludeTabTexts={secondStage ? EXCLUDED_TABS_2ND : MATH2_ECOSYSTEM_EXCLUDED_TABS}
              tabOverrides={secondStage ? TAB_OVERRIDES_2ND : undefined}
            />
          )}
        </div>

        <MathVoicedVideos
          secondStage={secondStage}
          videos={fyzika ? FYZIKA_VIDEOS : undefined}
          sansTitle
          controls
          className="mt-14 !px-0"
          title="Jak to vypadá v hodině"
          body={videosBody}
        />

        {apps.length > 0 && (
          <>
            <p className="mt-8 text-[14px] font-bold text-[#001161]/45" style={{ fontFamily: FF }}>
              {formatTypography(fyzika ? 'A k tomu další aplikace k fyzice' : 'A k tomu další aplikace k matematice')}
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((app) => (
                <li key={app.name} className="flex gap-4 rounded-[20px] bg-[#f8f9fc] p-4 ring-1 ring-[#001161]/6">
                  <img
                    src={app.icon}
                    alt=""
                    loading="lazy"
                    className={`h-14 w-14 shrink-0 rounded-[14px] shadow-sm ${app.iconContain ? 'bg-white object-contain p-2.5' : 'object-cover'}`}
                  />
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
