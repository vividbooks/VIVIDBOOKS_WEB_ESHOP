import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { getProductImage } from './cartUpsellUtils';

/** Balíčky pilotáže matematiky v eshopu mají id `pilotaz-…` (viz MathPilotLandingPage). */
export function isPilotBundleId(id: unknown): boolean {
  return String(id ?? '').startsWith('pilotaz-');
}

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/**
 * Jeden obecný box pilotáže na detailu sešitu matematiky místo boxu za každý balíček
 * (sešit je v balíčku celé řady i ročníku). Vede na /matematika-pilotovani, kde se balíček vybírá.
 */
function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Obrázek tabletu z produktu digitálního přístupu ke stejnému stupni (např. „Digitální učebnice rozšířený přístup“). */
function digitalAccessImage(product: any, products: any[]): string | undefined {
  const stage = normalize(product?.category).includes('1. stupen') ? '1. stupen' : '2. stupen';
  const digital = products.find(
    (p) => (p.type === 'online' || p.type === 'license') && normalize(p.category).includes('matematika') && normalize(p.category).includes(stage) && getProductImage(p),
  );
  return digital ? getProductImage(digital) : undefined;
}

export function MathPilotPromoBox({ product, products }: { product: any; products: any[] }) {
  const cover = getProductImage(product);
  const tablet = digitalAccessImage(product, products);
  return (
    <div className="overflow-hidden rounded-[20px] border border-[#7C3AED]/25 bg-[#f3eeff]" style={FF}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <Link to="/matematika-pilotovani" className="relative mx-auto block h-[132px] w-[190px] shrink-0" aria-label="Pilotáž matematiky">
          {tablet ? (
            <img
              src={tablet}
              alt="Interaktivní matematika na tabletu"
              loading="lazy"
              className="absolute right-0 top-0 h-[120px] w-[140px] rounded-[14px] object-contain"
            />
          ) : null}
          {cover ? (
            <img
              src={cover}
              alt={product?.name ?? 'Pracovní sešit'}
              loading="lazy"
              className="absolute bottom-0 left-1 h-[118px] w-auto -rotate-6 object-contain drop-shadow-[0_4px_10px_rgba(0,17,97,0.22)]"
            />
          ) : null}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C3AED]">
            {'Pilotáž matematiky · do 31. 12. 2026'}
          </p>
          <p className="mt-1 text-[16px] font-bold leading-snug text-[#001161] sm:text-[17px]">
            {'Interaktivní verze zdarma do konce školního roku a sešity o 20 % levněji'}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-[#001161]/65">
            {'Tento sešit koupíte se slevou v balíčku celé řady nebo jednoho ročníku. K tomu celá interaktivní matematika pro školu zdarma až do konce školního roku.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/matematika-pilotovani#sesity"
              className="inline-flex items-center gap-2 rounded-xl bg-[#001161] px-4 py-2.5 text-[14px] font-bold text-white transition hover:bg-[#001161]/85"
            >
              {'Vybrat balíček se slevou'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/matematika-pilotovani"
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
