import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { publicAssetUrl } from '../utils/publicAssetUrl';

/** Balíčky pilotáže matematiky v eshopu mají id `pilotaz-…` (viz MathPilotLandingPage). */
export function isPilotBundleId(id: unknown): boolean {
  return String(id ?? '').startsWith('pilotaz-');
}

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/**
 * Jeden obecný box pilotáže na detailu sešitu matematiky místo boxu za každý balíček
 * (sešit je v balíčku celé řady i ročníku). Vede na /pilotaz, kde se balíček vybírá.
 */
export function MathPilotPromoBox() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-[#7C3AED]/25 bg-[#f3eeff]" style={FF}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <Link to="/pilotaz" className="block shrink-0 sm:w-[150px]" aria-label="Pilotáž matematiky">
          <img
            src={publicAssetUrl('matematika-videa/reseni-nastenka.jpg')}
            alt="Interaktivní matematika na tabuli"
            loading="lazy"
            className="block aspect-video w-full rounded-[12px] object-cover shadow-[0_4px_14px_rgba(0,17,97,0.14)]"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C3AED]">
            {'Pilotáž matematiky · do 31. 12. 2026'}
          </p>
          <p className="mt-1 text-[16px] font-bold leading-snug text-[#001161] sm:text-[17px]">
            {'Interaktivní verze na rok zdarma a sešity o 20 % levněji'}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-[#001161]/65">
            {'Tento sešit koupíte se slevou v balíčku celé řady nebo jednoho ročníku. K tomu celá interaktivní matematika pro školu na celý školní rok zdarma.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/pilotaz#sesity"
              className="inline-flex items-center gap-2 rounded-xl bg-[#001161] px-4 py-2.5 text-[14px] font-bold text-white transition hover:bg-[#001161]/85"
            >
              {'Vybrat balíček se slevou'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pilotaz"
              className="inline-flex items-center rounded-xl border border-[#001161]/15 bg-white px-4 py-2.5 text-[14px] font-bold text-[#001161] transition hover:bg-white/70"
            >
              {'Více o pilotáži'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
