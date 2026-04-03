import React, { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import {
  acceptAllCookies,
  hasValidCookieConsent,
  OPEN_COOKIE_SETTINGS,
  readCookieConsent,
  rejectOptionalCookies,
  saveCookieConsent,
} from '@/lib/cookieConsentStorage';

const GDPR_URL = 'https://www.vividbooks.cz/gdpr';

function ToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#001161]/10 bg-[#001161]/[0.03] p-3 sm:p-4">
      <div className="min-w-0 flex-1">
        <p className="font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161]">{label}</p>
        <p className="mt-1 font-['Fenomen_Sans',sans-serif] text-[12px] leading-snug text-[#001161]/70">{description}</p>
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[#001161]' : 'bg-[#001161]/20'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function initialToggles(): { analytics: boolean; marketing: boolean } {
  const c = readCookieConsent();
  return { analytics: c?.analytics ?? false, marketing: c?.marketing ?? false };
}

export function CookieConsentBar() {
  const titleId = useId();
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !hasValidCookieConsent();
    } catch {
      return true;
    }
  });
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs] = useState(initialToggles);

  const syncFromStorage = useCallback(() => {
    const c = readCookieConsent();
    if (c) setPrefs({ analytics: c.analytics, marketing: c.marketing });
  }, []);

  useEffect(() => {
    const open = () => {
      syncFromStorage();
      setExpanded(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, open);
  }, [syncFromStorage]);

  const close = () => {
    setVisible(false);
    setExpanded(false);
  };

  const onAcceptAll = () => {
    acceptAllCookies();
    close();
  };

  const onRejectOptional = () => {
    rejectOptionalCookies();
    close();
  };

  const onSaveSelection = () => {
    saveCookieConsent({ analytics: prefs.analytics, marketing: prefs.marketing });
    close();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[170] p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pointer-events-none"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-4 rounded-[20px] border border-[#001161]/10 bg-white p-5 shadow-[0_12px_40px_rgba(0,17,97,0.12)]">
        <h2 id={titleId} className="sr-only">
          Souhlas s cookies a zpracováním údajů
        </h2>

        <div className="min-w-0 space-y-2">
          <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">
            {'Cookies a ochrana soukromí'}
          </p>
          <p className="font-['Fenomen_Sans',sans-serif] text-[13px] leading-snug text-[#001161]/85">
            {
              'Používáme cookies potřebné k provozu webu a košíku. Analytické a marketingové cookies nastavíme jen s vaším souhlasem. Svůj výběr můžete kdykoli změnit. Podrobnosti najdete v '
            }
            <a
              href={GDPR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#001161] underline decoration-[#001161]/25 underline-offset-2 hover:decoration-[#001161]"
            >
              {'Zásadách ochrany osobních údajů'}
            </a>
            {'. Kontakt: '}
            <Link
              to="/kontakt"
              className="font-bold text-[#001161] underline decoration-[#001161]/25 underline-offset-2 hover:decoration-[#001161]"
            >
              {'Kontakt'}
            </Link>
            {'.'}
          </p>
        </div>

        {expanded && (
          <div className="space-y-2 border-t border-[#001161]/10 pt-4">
            <ToggleRow
              id={`${titleId}-nec`}
              label="Nezbytné"
              description="Nutné pro fungování webu, košíku, platby a zabezpečení. Nelze vypnout."
              checked
              disabled
            />
            <ToggleRow
              id={`${titleId}-ana`}
              label="Analytické"
              description="Pomáhají nám pochopit návštěvnost a zlepšovat služby (např. anonymizované statistiky)."
              checked={prefs.analytics}
              onChange={(next) => setPrefs((p) => ({ ...p, analytics: next }))}
            />
            <ToggleRow
              id={`${titleId}-mkt`}
              label="Marketingové"
              description="Pro relevantnější obsah a měření účinnosti kampaní (např. personalizace, remarketing)."
              checked={prefs.marketing}
              onChange={(next) => setPrefs((p) => ({ ...p, marketing: next }))}
            />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
          {!expanded ? (
            <>
              <button
                type="button"
                onClick={onRejectOptional}
                className="order-2 rounded-[14px] border-2 border-[#001161]/20 bg-white px-4 py-2.5 font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] transition-opacity hover:bg-[#001161]/5 sm:order-1"
              >
                {'Pouze nezbytné'}
              </button>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="order-3 rounded-[14px] border-2 border-[#001161] bg-white px-4 py-2.5 font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] transition-opacity hover:bg-[#001161]/5 sm:order-2"
              >
                {'Nastavit'}
              </button>
              <button
                type="button"
                onClick={onAcceptAll}
                className="order-1 rounded-[14px] bg-[#001161] px-5 py-2.5 font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-white transition-opacity hover:opacity-90 sm:order-3"
              >
                {'Přijmout vše'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-[14px] border border-[#001161]/15 px-4 py-2.5 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/80 hover:bg-[#001161]/5"
              >
                {'Zpět'}
              </button>
              <button
                type="button"
                onClick={onRejectOptional}
                className="rounded-[14px] border-2 border-[#001161]/20 bg-white px-4 py-2.5 font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] hover:bg-[#001161]/5"
              >
                {'Pouze nezbytné'}
              </button>
              <button
                type="button"
                onClick={onSaveSelection}
                className="rounded-[14px] bg-[#001161] px-5 py-2.5 font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-white hover:opacity-90"
              >
                {'Uložit výběr'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
