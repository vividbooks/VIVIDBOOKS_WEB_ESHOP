import React from 'react';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/**
 * Zaškrtávací dlaždice pro předmět / stupeň. Sdílí ji trial formulář
 * (`/vyzkousejte`) i registrace na webinář, aby se obě místa ptala stejně.
 */
export function SubjectCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all text-left ${checked ? 'bg-[#7C3AED]/8 border-[#7C3AED]/40' : 'bg-white border-[#001161]/10 hover:border-[#7C3AED]/30'}`}
    >
      <span
        className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-[#7C3AED] border-[#7C3AED]' : 'border-[#001161]/20 bg-white'}`}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span style={FF} className="text-[14px] text-[#001161] font-medium">
        {label}
      </span>
    </button>
  );
}
