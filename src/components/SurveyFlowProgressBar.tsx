import React from 'react';

const NAVY = '#001161';

/**
 * Společný progress pruh pro celý průvodce (DVPP + zpětná vazba + odeslání + certifikát).
 */
export function SurveyFlowProgressBar({
  total,
  filled,
  className = '',
}: {
  total: number;
  /** Počet segmentů vyplněných (tmavě modré) — `total` = vše hotovo. */
  filled: number;
  className?: string;
}) {
  if (total <= 0) return null;
  const safe = Math.max(0, Math.min(filled, total));
  return (
    <div
      className={`flex justify-center gap-1 px-2 ${className}`}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-1.5 min-w-[6px] max-w-[40px] flex-1 rounded-full transition-colors duration-300 sm:max-w-[48px]"
          style={{
            backgroundColor: i < safe ? NAVY : 'rgba(0,17,97,0.12)',
          }}
        />
      ))}
    </div>
  );
}
