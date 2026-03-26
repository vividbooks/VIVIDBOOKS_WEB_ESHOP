import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';

const STORAGE_KEY = 'vividbooks_cookie_consent_v1';

export function CookieConsentBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      /* private mode atd. */
    }
    setVisible(true);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[170] p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pointer-events-none"
      role="dialog"
      aria-label="Informace o cookies"
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-4 rounded-[20px] border border-[#001161]/10 bg-white p-5 shadow-[0_12px_40px_rgba(0,17,97,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="font-['Fenomen_Sans',sans-serif] text-[13px] leading-snug text-[#001161]/85">
            {
              'Tento web používá cookies nezbytné pro fungování e‑shopu (např. košík) a k zajištění bezpečnosti. Další informace o zpracování údajů vám rádi poskytneme na stránce '
            }
            <Link
              to="/kontakt"
              className="font-bold text-[#001161] underline decoration-[#001161]/25 underline-offset-2 hover:decoration-[#001161]"
            >
              {'Kontakt'}
            </Link>
            {'.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          <button
            type="button"
            onClick={accept}
            className="rounded-[14px] bg-[#001161] px-5 py-2.5 font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-white transition-opacity hover:opacity-90"
          >
            {'Rozumím'}
          </button>
        </div>
      </div>
    </div>
  );
}
