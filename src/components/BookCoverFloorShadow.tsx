import React from 'react';

/**
 * Malý „skvrna“ stínu těsně pod obálkou — rodič omezuje plochu (w / max-h);
 * gradient je krátký, aby nevyplýtval velký obdélník.
 */
export function BookCoverFloorShadow({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        pointerEvents: 'none',
        background:
          'radial-gradient(ellipse 72% 88% at 50% 78%, rgba(0,17,97,0.44) 0%, rgba(0,17,97,0.14) 38%, rgba(0,17,97,0.03) 55%, transparent 62%)',
      }}
    />
  );
}
