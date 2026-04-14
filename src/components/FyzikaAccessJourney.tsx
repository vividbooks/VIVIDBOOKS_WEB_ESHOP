import React from 'react';
import { BookOpen, Check, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useProducts } from '../contexts/ProductsContext';

const BASIC_FEATURES = ['Učební text', 'Pracovní listy', 'Metodická inspirace'];

const FULL_FEATURES = [
  'Učební text',
  'Pracovní listy',
  'Lekce s animacemi',
  'Metodická inspirace',
  'Testy, písemky a procvičování',
  'Soutěžní kvízy',
  'Experimenty a úlohy',
  'Tvorba vlastních interaktivních materiálů',
];

/** Sdílený úvod k bloku základní vs. rozšířený (PDP, stránka předmětu). */
export const DIGITAL_ACCESS_TYPES_INTRO_TITLE =
  'Dva typy digit\u00e1ln\u00edho p\u0159\u00edstupu:\u00a0';
export const DIGITAL_ACCESS_TYPES_INTRO_BODY =
  'Z\u00e1kladn\u00ed m\u00e1te zdarma k pracovn\u00edm se\u0161it\u016fm. Roz\u0161\u00ed\u0159en\u00fd si dokoup\u00edte licenc\u00ed. Vyberte si variantu podle sv\u00fdch pot\u0159eb.';

/** Cooper odstavcový nadpis (dva tóny barvy, stejná velikost u obou částí). */
export const COOPER_ACCESS_INTRO_HEADING_STYLE: React.CSSProperties = {
  fontFamily: "'Cooper Light', serif",
  fontSize: 'clamp(28px, 3.5vw, 38px)',
  fontWeight: 400,
  lineHeight: 1.15,
  color: '#001161',
};

export const COOPER_ACCESS_INTRO_MUTED_STYLE: React.CSSProperties = {
  color: 'rgba(0,17,97,0.45)',
  fontFamily: "'Cooper Light', serif",
  fontSize: '1em',
  fontWeight: 400,
  lineHeight: 'inherit',
};

interface FyzikaAccessJourneyProps {
  onOrder?: () => void;
  compact?: boolean;
  subject?: string;
  /** Uvodni Cooper odstavec (jako „Učebnice jako ekosystém“ na PDP). Vypnout, kdyz nad blokem uz je vlastni nadpis. */
  showIntro?: boolean;
}

export function FyzikaAccessJourney({ onOrder, compact = false, subject = 'Fyzika', showIntro = true }: FyzikaAccessJourneyProps) {
  const navigate = useNavigate();
  const { products } = useProducts();

  const onlineProduct = products.find(
    (p) => p.type === 'online' && (p.category || '').replace(/\s+\d+\.\s*stupe.*$/i, '').trim() === subject,
  );

  const handlePredplatit = () => {
    if (onlineProduct) {
      navigate(`/produkt/${encodeURIComponent(onlineProduct.id)}`);
    } else {
      navigate('/vyzkousejte');
    }
  };

  const pad = compact ? 'p-5 sm:p-6' : 'p-6 sm:p-7';
  const titleClass = compact
    ? "font-['Cooper_Light',serif] text-[clamp(20px,2.2vw,23px)]"
    : "font-['Cooper_Light',serif] text-[clamp(22px,2.4vw,28px)]";
  const cardBase = `flex flex-col gap-4 rounded-[20px] border bg-white ${pad}`;
  const labelClass =
    "mb-1 font-['Fenomen_Sans',sans-serif] text-[11px] font-bold uppercase tracking-[0.15em] text-[#001161]/40";
  const featureClass =
    "font-['Fenomen_Sans',sans-serif] text-[14px] leading-snug text-[#001161]/80";

  return (
    <div className={`flex flex-col ${compact ? 'gap-5' : 'gap-8'}`}>
      {showIntro && (
               <h2 className="leading-tight max-w-[820px]" style={COOPER_ACCESS_INTRO_HEADING_STYLE}>
          {DIGITAL_ACCESS_TYPES_INTRO_TITLE}
          <span style={COOPER_ACCESS_INTRO_MUTED_STYLE}>{DIGITAL_ACCESS_TYPES_INTRO_BODY}</span>
        </h2>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 items-stretch">
        {/* Základní přístup */}
        <div className={`${cardBase} border-[#001161]/10`}>
          <span className="self-start rounded-full bg-[#27ae60] px-2.5 py-1 font-['Fenomen_Sans',sans-serif] text-[10px] font-bold uppercase tracking-[0.12em] text-white">
            ZDARMA
          </span>

          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#001161]/12 bg-[#f8f9fc]"
              aria-hidden
            >
              <BookOpen className="h-5 w-5 text-[#001161]/55" strokeWidth={2} />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className={labelClass}>Základní digitální přístup</p>
              <h3 className={`${titleClass} leading-[1.12] text-[#001161]`}>Základní digitální přístup</h3>
            </div>
          </div>

          <div className="h-px bg-[#001161]/8" />

          <ul className="flex flex-col gap-2">
            {BASIC_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#001161]/8">
                  <Check className="h-3 w-3 text-[#001161]/65" strokeWidth={2.5} />
                </div>
                <span className={featureClass}>{f}</span>
              </li>
            ))}
          </ul>

          <p className="border-t border-[#001161]/8 pt-4 font-['Fenomen_Sans',sans-serif] text-[13px] leading-relaxed text-[#001161]/55">
            Pro školy automaticky od 15 ks sešitů. Pro rodiče dostupné jako předplatné.
          </p>
        </div>

        {/* Rozšířený přístup */}
        <div className={`${cardBase} border-[#001161]/12`}>
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#001161]/12 bg-[#f8f9fc]"
              aria-hidden
            >
              <Sparkles className="h-5 w-5 text-[#001161]/55" strokeWidth={2} />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className={labelClass}>Rozšířený digitální přístup</p>
              <h3 className={`${titleClass} leading-[1.12] text-[#001161]`}>Digitální učebnice</h3>
            </div>
          </div>

          <div className="h-px bg-[#001161]/8" />

          <ul className="flex flex-col gap-2">
            {FULL_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#001161]/8">
                  <Check className="h-3 w-3 text-[#001161]/65" strokeWidth={2.5} />
                </div>
                <span className={featureClass}>{f}</span>
              </li>
            ))}
          </ul>

          <div className="h-px bg-[#001161]/8" />

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onOrder}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[14px] bg-[#001161] px-5 py-3 font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-white transition-all hover:bg-[#000a3d] active:scale-[0.99]"
            >
              Poptávka pro školu
              <ChevronRight className="h-3.5 w-3.5 opacity-90" />
            </button>
            <a
              href="/vyzkousejte"
              className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[14px] border border-[#001161]/15 bg-white px-5 py-3 font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161] transition-all hover:bg-[#001161]/5"
              onClick={(e) => {
                e.preventDefault();
                handlePredplatit();
              }}
            >
              Předplatit za 299 Kč / měsíc
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
