import React, { useRef, useState } from 'react';
import { CheckCircle2, Play } from 'lucide-react';
import { publicAssetUrl } from '../utils/publicAssetUrl';

/** Minimální počet sešitů, od kterého škola dostane interaktivní matematiku zdarma. */
export const MATH_INTERACTIVE_FREE_FROM_QTY = 15;

const FEATURES_1ST = [
  'Každá stránka sešitu na tabuli',
  'Řešení u každé úlohy',
  'Minihry k procvičení',
  'Početník',
  'Matematická tabule',
  'Pomůcky k vytištění',
];

const FEATURES_2ND = [
  'Každý list sešitu na tabuli',
  'Řešení krok po kroku',
  'Učební text',
  'Procvičování a soutěže',
  'Testy a písemky',
  'Aplikace Rýsování',
];

/**
 * Rámeček pod cenou sešitu matematiky: interaktivní verze je v ceně sešitů
 * (pro školy od 15 ks), aby nepůsobila jako placený doplněk.
 */
export function MathInteractiveIncluded({ secondStage }: { secondStage: boolean; subjectSlug?: string }) {
  const features = secondStage ? FEATURES_2ND : FEATURES_1ST;
  return (
    <div
      className="rounded-[16px] border-2 border-[#f5b97a] bg-[#fff4e8] px-4 py-4 md:px-5"
      style={{ fontFamily: "'Fenomen Sans', sans-serif", color: '#001161' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
        <p className="text-[15px] font-bold leading-snug">{'K sešitům dostanete interaktivní matematiku'}</p>
        <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#c2620f]">
          {`zdarma při objednávce od ${MATH_INTERACTIVE_FREE_FROM_QTY} ks`}
        </span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-[13px] leading-snug">
            <CheckCircle2 className="w-4 h-4 mt-px shrink-0 text-[#e8832a]" />
            {f}
          </li>
        ))}
      </ul>
      <p className="text-[12px] leading-snug text-[#001161]/70">
        {`Stačí objednat pro třídu aspoň ${MATH_INTERACTIVE_FREE_FROM_QTY} sešitů a celá škola dostane přístup do aplikace Vividbooks, bez dalších poplatků. `}
        <a
          href="#videa-z-aplikace"
          onClick={e => {
            const el = document.getElementById('videa-z-aplikace');
            if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          }}
          className="font-bold text-[#5b4fd8] hover:underline"
        >
          {'Podívejte se na videa z aplikace'}
        </a>
      </p>
    </div>
  );
}

function sesitWord(n: number): string {
  if (n === 1) return 'sešit';
  if (n >= 2 && n <= 4) return 'sešity';
  return 'sešitů';
}

/** Je řádek košíku tištěný sešit matematiky? (počítá se do limitu 15 ks) */
export function isMathWorkbookCartLine(item: { productName?: string; itemGroup?: string; bundleId?: string }): boolean {
  const text = `${item.productName || ''} ${item.itemGroup || ''}`.toLowerCase();
  return text.includes('matematik') && !/digit|p[řr]edplatn|licenc/.test(text);
}

/**
 * Ukazatel v košíku / objednávce: kolik sešitů matematiky zbývá do interaktivní verze zdarma.
 * Po dosažení limitu se zazelená a potvrdí, že je v ceně.
 */
export function MathInteractiveMeter({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  const limit = MATH_INTERACTIVE_FREE_FROM_QTY;
  const left = Math.max(0, limit - count);
  const done = left === 0;
  const pct = Math.min(100, Math.round((count / limit) * 100));
  return (
    <div
      className={`rounded-[14px] border px-4 py-3 ${done ? 'border-[#1f9d55] bg-[#e9f7ef]' : 'border-[#5b4fd8]/20 bg-[#f3f1fe]'} ${className}`}
      style={{ fontFamily: "'Fenomen Sans', sans-serif", color: '#001161' }}
    >
      <p className="text-[13px] font-bold leading-snug mb-2">
        {done
          ? '✓ Interaktivní matematika v ceně'
          : `Ještě ${left} ${sesitWord(left)} matematiky a máte interaktivní verzi zdarma`}
      </p>
      <div
        className="h-2 rounded-full bg-white overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(count, limit)}
        aria-label="Sešity matematiky do interaktivní verze zdarma"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${done ? 'bg-[#1f9d55]' : 'bg-[#5b4fd8]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] leading-snug text-[#001161]/65 mt-2">
        {done
          ? 'Škola dostane přístup do aplikace k matematice pro všechny třídy.'
          : `Od ${limit} ks sešitů matematiky dostane škola přístup do aplikace. Máte ${count} ks.`}
      </p>
    </div>
  );
}

type VoicedVideo = { file: string; title: string; note: string; len: string };

/** Namluvená videa z Remotionu (16:9, se zvukem). Soubory: public/matematika-videa/<file>.mp4 + .jpg */
const VOICED_1ST: VoicedVideo[] = [
  { file: 'reseni-nastenka', title: 'Řešení na nástěnce', note: 'Úloha po úloze, řešení odkrýváte po krocích přímo na tabuli.', len: '1:02' },
];
const VOICED_2ND: VoicedVideo[] = [
  { file: 'reseni-nastenka', title: 'Řešení na nástěnce', note: 'Úloha po úloze, řešení odkrýváte po krocích přímo na tabuli.', len: '1:02' },
  { file: 'pocetnik', title: 'Početník', note: 'Procvičování, které přitvrdí, když se daří.', len: '0:39' },
  { file: 'slovni-ulohy', title: 'Slovní úlohy', note: 'Pokaždé nová čísla, nápověda i výsledek.', len: '0:33' },
  { file: 'prijimaci-zkousky', title: 'Přijímací zkoušky', note: 'Testy Cermat s nápovědou a podobnými úlohami.', len: '0:44' },
  { file: 'rysovani', title: 'Rýsování', note: 'Konstrukce krok po kroku v aplikaci Rýsování.', len: '0:35' },
];

const voicedUrl = (file: string, ext: 'mp4' | 'jpg') => publicAssetUrl(`matematika-videa/${file}.${ext}`);
const FF_SANS = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/** Sekce pod listováním: jeden přehrávač a vedle seznam namluvených videí; klik v seznamu přepne a pustí video. */
export function MathVoicedVideos({ secondStage }: { secondStage: boolean }) {
  const videos = secondStage ? VOICED_2ND : VOICED_1ST;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const current = videos[idx] ?? videos[0];

  const play = () => { const el = ref.current; if (el) void el.play().catch(() => {}); };
  const toggle = () => { const el = ref.current; if (!el) return; if (el.paused) play(); else el.pause(); };
  const pick = (i: number) => {
    if (i === idx) { toggle(); return; }
    setIdx(i);
    // nový zdroj se načte po renderu; pustit hned, jak je video připravené
    requestAnimationFrame(() => play());
  };

  return (
    <section id="videa-z-aplikace" className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-16 scroll-mt-24" aria-label="Videa z aplikace">
      <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] md:text-[38px] leading-tight">
        {'Jak to vypadá v aplikaci'}
      </h2>
      <p className="mt-2 mb-7 max-w-[640px] text-[15px] leading-relaxed text-[#001161]/60" style={FF_SANS}>
        {'Krátká videa se zvukem: co k sešitu dostanete v interaktivní matematice. Ke třídní objednávce od 15 sešitů je v ceně.'}
      </p>

      <div className={videos.length > 1 ? 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:items-start' : 'max-w-[860px]'}>
        <div className="relative overflow-hidden rounded-[20px] bg-[#eef0f6]">
          <video
            key={current.file}
            ref={ref}
            src={voicedUrl(current.file, 'mp4')}
            poster={voicedUrl(current.file, 'jpg')}
            className="block aspect-video w-full cursor-pointer"
            playsInline
            preload="metadata"
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); if (idx < videos.length - 1) pick(idx + 1); }}
          />
          {!playing && (
            <button
              type="button"
              onClick={play}
              aria-label={`Přehrát video: ${current.title}`}
              className="absolute inset-0 grid place-items-center cursor-pointer"
            >
              <span className="grid size-16 place-items-center rounded-full bg-[#5b4fd8] text-white shadow-[0_8px_24px_rgba(91,79,216,0.45)] transition-transform hover:scale-105 sm:size-20">
                <Play className="ml-1 h-7 w-7 fill-current sm:h-8 sm:w-8" />
              </span>
            </button>
          )}
        </div>

        {videos.length > 1 && (
          <ol className="flex flex-col gap-1" style={FF_SANS}>
            {videos.map((v, i) => {
              const active = i === idx;
              return (
                <li key={v.file}>
                  <button
                    type="button"
                    onClick={() => pick(i)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full items-center gap-3.5 rounded-[14px] p-2 text-left transition-colors cursor-pointer ${active ? 'bg-[#f0eeff]' : 'hover:bg-[#f6f6fb]'}`}
                  >
                    <span className="relative block w-[112px] shrink-0 overflow-hidden rounded-[10px] bg-[#eef0f6]">
                      <img src={voicedUrl(v.file, 'jpg')} alt="" className="block aspect-video w-full object-cover" loading="lazy" />
                      <span className="absolute bottom-1 right-1 rounded-md bg-[#001161]/75 px-1.5 py-px text-[10.5px] font-semibold text-white tabular-nums">{v.len}</span>
                    </span>
                    <span className="min-w-0">
                      <span className={`flex items-center gap-1.5 text-[14.5px] font-bold ${active ? 'text-[#5b4fd8]' : 'text-[#001161]'}`}>
                        {active && playing && <span className="inline-block size-1.5 rounded-full bg-[#5b4fd8] animate-pulse" aria-hidden="true" />}
                        {v.title}
                      </span>
                      <span className="block text-[12.5px] leading-snug text-[#001161]/55">{v.note}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
