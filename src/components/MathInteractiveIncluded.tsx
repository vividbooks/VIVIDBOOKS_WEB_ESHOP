import React from 'react';
import { Link } from 'react-router';
import { CheckCircle2 } from 'lucide-react';

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
