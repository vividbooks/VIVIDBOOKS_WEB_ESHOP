import React from 'react';
import { Check } from 'lucide-react';

const COMPLIANCE_BADGE_COLOR = 'rgba(75, 72, 204, 0.88)';

/** Odznaky „Podle RVP“ / „Doložka MŠMT“ — tenký rámeček, book řez, malé kolečko s fajfkou */
export function ProductComplianceBadge({ children }: { children: React.ReactNode }) {
  const c = COMPLIANCE_BADGE_COLOR;
  return (
    <div
      className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-lg border border-solid bg-transparent shrink-0"
      style={{ borderColor: c, color: c }}
    >
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full shrink-0"
        style={{ background: c }}
        aria-hidden
      >
        <Check className="w-2.5 h-2.5 text-white" strokeWidth={2.25} />
      </span>
      <span className="font-['Fenomen_Sans',sans-serif] text-[12px] sm:text-[12px] font-normal leading-tight tracking-tight">
        {children}
      </span>
    </div>
  );
}

/** Doložka MŠMT badge — všechny předměty kromě češtiny */
export function subjectShowsMsmtDolozkaBadge(baseSubject: string): boolean {
  const key = baseSubject.trim().toLowerCase();
  if (key === 'český jazyk') return false;
  // ASCII fallback (URL / data bez diakritiky)
  if (key.includes('cesky') && key.includes('jazyk')) return false;
  return true;
}
