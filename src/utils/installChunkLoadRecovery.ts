const STORAGE_KEY = 'vb_chunk_autoreload_once';

/**
 * Po deployi může být v prohlížeči starý `index.html` / hlavní bundle s odkazy na staré hashe chunků
 * (404 na GitHub Pages → „Failed to fetch dynamically imported module“).
 * Jednorázové obnovení stránky načte nový index a obnoví mapu chunků.
 */
export function installChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return;
  // Ve vývoji Vite často hlásí stejnou hlášku při HMR / restartu dev serveru — auto-reload by jen překážel.
  if (import.meta.env.DEV) return;

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : reason && typeof reason === 'object' && 'message' in reason
            ? String((reason as { message: unknown }).message)
            : '';
    if (!msg) return;
    if (
      !/Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed|error loading dynamically imported module/i.test(
        msg,
      )
    ) {
      return;
    }
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      return;
    }
    event.preventDefault();
    window.location.reload();
  });
}

/** Po úspěšném běhu aplikace uvolní další auto-reload po příštím deployi. */
export function scheduleChunkReloadFlagClear(): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, 20000);
}
