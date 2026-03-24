import React, { useId } from 'react';

/** Společný „podlahový“ elipsoid pod tiskovinou — inline SVG = bez HTTP requestu, funguje i s GitHub Pages base. */
export function BookCoverFloorShadow({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const gid = `bookFloorShadow-${uid}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 100"
      fill="none"
      aria-hidden
      className={className}
    >
      <ellipse cx="160" cy="52" rx="145" ry="44" fill={`url(#${gid})`} />
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#001161" stopOpacity="0.5" />
          <stop offset="38%" stopColor="#001161" stopOpacity="0.24" />
          <stop offset="72%" stopColor="#001161" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#001161" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
