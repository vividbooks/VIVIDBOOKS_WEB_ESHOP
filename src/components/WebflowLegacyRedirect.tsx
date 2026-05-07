import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  pathnameLooksLikeWebflowLegacy,
  resolveWebflowLegacyWithFallback,
  normalizeLegacyPathname,
} from '@/config/webflowLegacyRedirects';

/** Nesmíme přesměrovávat interní nástroje ani uživatelské účty aplikace (jiná doména). */
function isAppInternalPath(pathname: string): boolean {
  return /^\/(admin|marketing|mailing|hub|assistant|asistent)(\/|$)/i.test(pathname);
}

/**
 * Po přesunu DNS z Webflow na tento SPA build zajistí náhradu za HTTP 301:
 * staré cesty (/cs/…) se přemapují na nové route nebo na fallback (/).
 * Externí cíle (např. aplikace učebnic) přes `window.location.replace`.
 */
export function WebflowLegacyRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const doneRef = useRef<string | null>(null);

  useEffect(() => {
    const path = normalizeLegacyPathname(location.pathname);
    const key = `${path}${location.search}${location.hash}`;
    if (isAppInternalPath(path)) return;
    if (!pathnameLooksLikeWebflowLegacy(path)) return;

    const res = resolveWebflowLegacyWithFallback(path);
    if (res.kind === 'none') return;

    if (doneRef.current === key) return;

    if (res.kind === 'external') {
      doneRef.current = key;
      window.location.replace(res.target);
      return;
    }

    const targetPath = normalizeLegacyPathname(res.target);
    if (targetPath === path) return;

    doneRef.current = key;
    navigate(`${targetPath}${location.search}${location.hash}`, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}
