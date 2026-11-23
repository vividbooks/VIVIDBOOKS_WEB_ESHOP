import React, { useEffect, useRef, useState } from 'react';
import {
  birthDateIsoFromParts,
  birthDatePartsFromIso,
  birthDatePartsLookInvalid,
  sanitizeBirthDateParts,
  type BirthDateParts,
} from '../utils/birthDateParts';

type Props = {
  /** `YYYY-MM-DD`, nebo '' dokud datum není celé a platné (stejně jako u <input type="date">). */
  value: string;
  onChange: (iso: string) => void;
  /** Třídy jednoho pole (bez šířky) — přebírá vzhled okolního formuláře. */
  inputClassName: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
};

/**
 * Datum narození jako tři číselná pole (den, měsíc, rok). Na telefonu se otevře číselná
 * klávesnice a rok se prostě napíše — nativní kalendář nutil listovat po měsících zpět.
 * Hodnota navenek zůstává `YYYY-MM-DD`, takže certifikát i ukládání fungují beze změny.
 */
export function BirthDateFields({ value, onChange, inputClassName, className, required, disabled }: Props) {
  const [parts, setParts] = useState<BirthDateParts>(() => birthDatePartsFromIso(value));
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  // Hodnota změněná zvenku (předvyplnění z uloženého kontaktu, vymazání formuláře).
  // Rozepsané datum dává navenek '' — to pole nesmí smazat.
  useEffect(() => {
    const current = birthDateIsoFromParts(partsRef.current);
    if (value === current) return;
    setParts(birthDatePartsFromIso(value));
  }, [value]);

  const update = (key: keyof BirthDateParts, raw: string) => {
    const prevLength = partsRef.current[key].length;
    const next = sanitizeBirthDateParts({ ...partsRef.current, [key]: raw });
    partsRef.current = next;
    setParts(next);
    const iso = birthDateIsoFromParts(next);
    if (iso !== value) onChange(iso);
    // Po dopsání pole skočit na další: dvě číslice, nebo jedna, ke které už druhá nejde přidat.
    // Jen při psaní, ne při mazání.
    const v = next[key];
    if (v.length <= prevLength) return;
    if (key === 'day' && (v.length === 2 || parseInt(v, 10) > 3)) monthRef.current?.focus();
    if (key === 'month' && (v.length === 2 || parseInt(v, 10) > 1)) yearRef.current?.focus();
  };

  const backspaceToPrev = (key: keyof BirthDateParts) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace' || partsRef.current[key] !== '') return;
    if (key === 'month') dayRef.current?.focus();
    if (key === 'year') monthRef.current?.focus();
  };

  const invalid = birthDatePartsLookInvalid(parts);
  const common = {
    type: 'text' as const,
    inputMode: 'numeric' as const,
    pattern: '[0-9]*',
    disabled,
    required,
    'aria-invalid': invalid || undefined,
    className: `${inputClassName} min-w-0 text-center`,
  };

  return (
    <div className={className}>
      <div role="group" aria-label="Datum narození" className="flex gap-2">
        <input
          {...common}
          ref={dayRef}
          value={parts.day}
          onChange={(e) => update('day', e.target.value)}
          placeholder="Den"
          aria-label="Den narození"
          autoComplete="bday-day"
          maxLength={2}
          style={{ flex: '1 1 0' }}
        />
        <input
          {...common}
          ref={monthRef}
          value={parts.month}
          onChange={(e) => update('month', e.target.value)}
          onKeyDown={backspaceToPrev('month')}
          placeholder="Měsíc"
          aria-label="Měsíc narození"
          autoComplete="bday-month"
          maxLength={2}
          style={{ flex: '1 1 0' }}
        />
        <input
          {...common}
          ref={yearRef}
          value={parts.year}
          onChange={(e) => update('year', e.target.value)}
          onKeyDown={backspaceToPrev('year')}
          placeholder="Rok"
          aria-label="Rok narození"
          autoComplete="bday-year"
          maxLength={4}
          style={{ flex: '1.4 1 0' }}
        />
      </div>
      {invalid ? (
        <p className="mt-1 text-[12px] text-red-600" role="alert">
          Zkontrolujte prosím datum narození – den, měsíc a rok číslicemi, například 5 3 1980.
        </p>
      ) : null}
    </div>
  );
}
