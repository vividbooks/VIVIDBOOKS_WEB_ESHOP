import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { CheckCircle2, Play, X } from 'lucide-react';
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

type Clip = { file: string; title: string; note: string };

/** Skutečné záznamy z aplikace po ročnících (čtverec 1080×1080, s kurzorem). Soubory: public/matematika-ukazka/r<ročník>-*.mp4 */
const CLIPS_BY_GRADE: Record<string, Clip[]> = {
  '1': [
    { file: 'r1-tabule', title: 'Stránka sešitu na tabuli', note: 'Kapitola Tři: úloha po úloze, řešení po krocích' },
    { file: 'r1-minihra', title: 'Minihra u úlohy', note: 'Nastavená jen na čísla, která žáci už znají' },
  ],
  '2': [
    { file: 'r2-tabule', title: 'Stránka sešitu na tabuli', note: 'Sčítání a odčítání do 20, řešení po krocích' },
    { file: 'r2-pocetnik', title: 'Početník u úlohy', note: 'Procvičování přesně k úloze ze sešitu' },
  ],
  '6': [
    { file: 'r6-reseni', title: 'Řešení krok po kroku', note: 'Odčítání desetinných čísel' },
    { file: 'r6-rys', title: 'Jak se to rýsuje', note: 'Obraz bodu v osové souměrnosti, aplikace Rýsování' },
  ],
  '7': [
    { file: 'r7-reseni', title: 'Řešení krok po kroku', note: 'Početní operace se zlomky' },
    { file: 'r7-rys', title: 'Jak se to rýsuje', note: 'Konstrukce trojúhelníků, aplikace Rýsování' },
  ],
  '8': [
    { file: 'r8-reseni', title: 'Řešení krok po kroku', note: 'Sčítání a odčítání algebraických výrazů' },
    { file: 'r8-rys', title: 'Jak se to rýsuje', note: 'Osa úhlu v aplikaci Rýsování' },
  ],
  '9': [
    { file: 'r9-reseni', title: 'Řešení krok po kroku', note: 'Lineární rovnice' },
    { file: 'r9-reseni2', title: 'Řešení geometrie', note: 'Rotační válec' },
  ],
};

const clipUrl = (file: string, ext: 'mp4' | 'jpg') => publicAssetUrl(`matematika-ukazka/${file}.${ext}`);

function ClipModal({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#001161]/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={clip.title}
    >
      <div className="relative w-full max-w-[min(92vw,78vh)]" onClick={e => e.stopPropagation()}>
        <video
          src={clipUrl(clip.file, 'mp4')}
          poster={clipUrl(clip.file, 'jpg')}
          className="block w-full rounded-[14px] bg-[#1f2233] shadow-2xl"
          autoPlay
          muted
          loop
          playsInline
          controls
        />
        <p className="mt-3 text-center text-white text-[14px]" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
          <b>{clip.title}</b>{` · ${clip.note}`}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zavřít ukázku"
          className="absolute -top-3 -right-3 grid size-9 place-items-center rounded-full bg-white text-[#001161] shadow-lg cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

const clipsFor = (secondStage: boolean, grade?: string | null) =>
  CLIPS_BY_GRADE[grade ?? ''] ?? CLIPS_BY_GRADE[secondStage ? '7' : '1'];

/** Čtverečky s ukázkami z aplikace pod náhledem sešitu (jako galerie u digitálního přístupu); klik otevře přehrávač. */
export function MathAppClipStrip({ secondStage, grade }: { secondStage: boolean; grade?: string | null }) {
  const [open, setOpen] = useState<Clip | null>(null);
  const clips = clipsFor(secondStage, grade);
  return (
    <div className="relative z-20 w-full shrink-0 pt-3" aria-label="Ukázky z aplikace">
      <div className="flex w-full flex-wrap justify-center gap-3 sm:gap-4">
        {clips.map(c => (
          <button
            key={c.file}
            type="button"
            onClick={() => setOpen(c)}
            title={`${c.title} · ${c.note}`}
            aria-label={`Přehrát ukázku: ${c.title}`}
            className="group flex w-[6.5rem] shrink-0 flex-col items-center gap-1.5 cursor-pointer sm:w-[7.5rem] focus-visible:outline-none"
          >
            <span className="relative block aspect-square w-full overflow-hidden rounded-xl border-2 border-[#001161]/30 bg-[#1f2233] transition-all group-hover:border-[#001161]/60 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#001161]">
              <video
                src={clipUrl(c.file, 'mp4')}
                poster={clipUrl(c.file, 'jpg')}
                className="block h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden="true"
              />
              <span className="absolute bottom-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-white/90 text-[#001161] shadow">
                <Play className="ml-px w-3 h-3 fill-current" />
              </span>
            </span>
            <span className="text-center text-[11px] font-semibold leading-tight text-[#001161]/70" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
              {c.title}
            </span>
          </button>
        ))}
      </div>
      {open && <ClipModal clip={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/**
 * Rámeček pod cenou sešitu matematiky: interaktivní verze je v ceně sešitů
 * (pro školy od 15 ks), aby nepůsobila jako placený doplněk.
 */
export function MathInteractiveIncluded({ secondStage, subjectSlug }: { secondStage: boolean; subjectSlug: string }) {
  const features = secondStage ? FEATURES_2ND : FEATURES_1ST;
  return (
    <div
      className="mb-6 rounded-[16px] border-2 border-[#1f9d55] bg-[#e9f7ef] px-4 py-4 md:px-5"
      style={{ fontFamily: "'Fenomen Sans', sans-serif", color: '#001161' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
        <p className="text-[15px] font-bold leading-snug">{'V ceně: interaktivní matematika pro celou školu'}</p>
        <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#1f9d55]">
          {`zdarma od ${MATH_INTERACTIVE_FREE_FROM_QTY} ks`}
        </span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-[13px] leading-snug">
            <CheckCircle2 className="w-4 h-4 mt-px shrink-0 text-[#1f9d55]" />
            {f}
          </li>
        ))}
      </ul>
      <p className="text-[12px] leading-snug text-[#001161]/70">
        {`Objednáte-li pro třídu aspoň ${MATH_INTERACTIVE_FREE_FROM_QTY} sešitů, škola dostane přístup do aplikace. Nic dalšího se nekupuje. `}
        <Link to={`/predmet/${subjectSlug}`} className="font-bold text-[#5b4fd8] hover:underline">
          {'Co v aplikaci najdete'}
        </Link>
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
