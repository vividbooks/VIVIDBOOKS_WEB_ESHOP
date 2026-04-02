import React from 'react';

/** React Router 7: lazy routy potřebují fallback při prvním načtení (jinak varování v konzoli). */
export function RouteHydrateFallback() {
  return (
    <div className="min-h-[100dvh] w-full bg-black flex items-center justify-center" aria-busy>
      <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" aria-hidden />
    </div>
  );
}
