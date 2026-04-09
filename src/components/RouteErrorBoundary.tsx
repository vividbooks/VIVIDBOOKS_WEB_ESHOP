import React from 'react';
import { useRouteError } from 'react-router';
import { ChunkLoadErrorFallback } from './ChunkLoadErrorFallback';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

function messageFromRouteError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

/** Typicky po deployi na GitHub Pages: starý main bundle odkazuje na neexistující chunk. */
function isStaleChunkError(msg: string): boolean {
  return /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed|error loading dynamically imported module/i.test(
    msg,
  );
}

/**
 * Globální errorElement pro router — nahrazuje výchozí „Unexpected Application Error!“
 * a u zastaralých chunků nabízí stejné UI jako při zachycení v route.lazy.
 */
export function RouteErrorBoundary() {
  const err = useRouteError();
  const msg = messageFromRouteError(err);

  if (isStaleChunkError(msg)) {
    return <ChunkLoadErrorFallback />;
  }

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center"
      style={FF}
    >
      <h1 className="text-lg font-bold text-[#001161]">Něco se pokazilo</h1>
      <p className="max-w-md text-[14px] leading-relaxed text-slate-600">
        Zkuste obnovit stránku. Pokud se chyba opakuje, napište nám prosím, co jste dělali před tím.
      </p>
      {import.meta.env.DEV ? (
        <pre className="max-w-full overflow-x-auto rounded-lg bg-slate-100 p-3 text-left text-[11px] text-slate-700">
          {msg}
        </pre>
      ) : null}
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
