import React from 'react';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/**
 * Zobrazení po selhání dynamického importu (typicky po deployi: starý hash v main bundle,
 * chunk už na GitHub Pages neexistuje → „Failed to fetch dynamically imported module“).
 */
export function ChunkLoadErrorFallback() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center"
      style={FF}
    >
      <h1 className="text-lg font-bold text-[#001161]">Nepodařilo se načíst část stránky</h1>
      <p className="max-w-md text-[14px] leading-relaxed text-slate-600">
        Často jde o novou verzi webu po aktualizaci. Zkuste obnovit stránku — načte se aktuální
        kód.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full bg-[#001161] px-6 py-2.5 text-[14px] font-bold text-white shadow-md transition hover:bg-[#001a8c]"
      >
        Obnovit stránku
      </button>
    </div>
  );
}
