import React from 'react';
import { Link } from 'react-router';
import { AlertCircle, Radio, RefreshCw } from 'lucide-react';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/**
 * Zobrazí se, když se nepodařilo dohledat webinář (typicky výpadek Edge API).
 * Dřív se v této situaci přesměrovávalo na /webinare, což divákům uprostřed
 * vysílání zavřelo stream. Nikdy tedy nenavigujeme pryč — nabídneme cesty dál.
 */
export function WebinarUnavailableNotice({ streamUrl }: { streamUrl?: string | null }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[480px] rounded-[28px] border border-[#001161]/8 bg-white p-9 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#001161]/8">
          <AlertCircle className="h-6 w-6 text-[#001161]" />
        </div>

        <h1 className="mb-2 text-[21px] font-bold text-[#001161]" style={FF}>
          {streamUrl ? 'Přepojujeme vás na vysílání' : 'Webinář se nepodařilo načíst'}
        </h1>
        <p className="mb-7 text-[14px] leading-relaxed text-[#001161]/55" style={FF}>
          {streamUrl
            ? 'Naše stránka teď nereaguje, ale vysílání běží dál. Pokud se nic nestane, klikněte na tlačítko níž.'
            : 'Nepodařilo se nám spojit se serverem. Zkuste to prosím znovu — vysílání ani váš přístup tím nejsou nijak ovlivněné.'}
        </p>

        <div className="flex flex-col gap-2.5">
          {streamUrl ? (
            <a
              href={streamUrl}
              className="flex items-center justify-center gap-2 rounded-full bg-[#001161] px-6 py-3 text-[14px] font-bold text-white shadow-md transition hover:bg-[#001a8c]"
              style={FF}
            >
              <Radio className="h-3.5 w-3.5" />
              {'Otevřít vysílání'}
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 rounded-full bg-[#F0F2F8] px-6 py-3 text-[14px] font-bold text-[#001161] transition hover:bg-[#e4e8f3]"
            style={FF}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {'Zkusit znovu'}
          </button>

          <Link
            to="/webinare"
            className="px-6 py-2 text-[13px] font-bold text-[#001161]/50 transition hover:text-[#001161]"
            style={FF}
          >
            {'Přehled webinářů a záznamů'}
          </Link>
        </div>
      </div>
    </div>
  );
}
