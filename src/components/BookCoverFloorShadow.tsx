import React from 'react';

/**
 * „Podlahový“ elipsoid pod tiskovinou — CSS radial-gradient (bez SVG `url(#id)`,
 * které na některých mobilech/WebKitech padá a vykreslí se jako černý čtverec).
 */
export function BookCoverFloorShadow({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        pointerEvents: 'none',
        background:
          'radial-gradient(ellipse 78% 62% at 50% 44%, rgba(0,17,97,0.48) 0%, rgba(0,17,97,0.22) 40%, rgba(0,17,97,0.07) 66%, transparent 74%)',
      }}
    />
  );
}
