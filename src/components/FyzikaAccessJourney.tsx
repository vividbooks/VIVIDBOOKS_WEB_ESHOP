import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useProducts } from '../contexts/ProductsContext';

const BASIC_FEATURES = [
  'Učební text',
  'Pracovní listy',
  'Metodická inspirace',
];

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

interface FyzikaAccessJourneyProps {
  onOrder?: () => void;
  compact?: boolean;
  subject?: string;
}

export function FyzikaAccessJourney({ onOrder, compact = false, subject = 'Fyzika' }: FyzikaAccessJourneyProps) {
  const navigate = useNavigate();
  const { products } = useProducts();

  // Najdi digitální licenci daného předmětu (type === 'online', category odpovídá předmětu)
  const onlineProduct = products.find(
    p => p.type === 'online' && (p.category || '').replace(/\s+\d+\.\s*stupe.*$/i, '').trim() === subject
  );

  const handlePredplatit = () => {
    if (onlineProduct) {
      navigate(`/produkt/${encodeURIComponent(onlineProduct.id)}`);
    } else {
      navigate('/vyzkousejte');
    }
  };

  return (
    <div className="flex flex-col gap-6">

      {/* ── Dvě karty ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

        {/* KARTA 1 — Základní přístup */}
        <div
          className="flex flex-col rounded-[24px] p-6 gap-4"
          style={{ background: '#eef2fb', border: '1.5px solid #a3b0e0' }}
        >
          <span
            className="self-start text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ background: '#22c55e', color: '#fff', fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            {'ZDARMA'}
          </span>

          <div className="flex items-start gap-3">
            <span className="text-[30px] leading-none shrink-0 mt-0.5">🔓</span>
            <div>
              <p
                className="text-[11px] font-bold uppercase tracking-wider mb-0.5"
                style={{ fontFamily: "'Fenomen Sans', sans-serif", color: '#001161', opacity: 0.4 }}
              >
                {'Základní digitální přístup'}
              </p>
              <h3
                className="text-[17px] font-black leading-tight"
                style={{ fontFamily: "'Fenomen Sans', sans-serif", color: '#001161' }}
              >
                {'Základní digitální přístup'}
              </h3>
            </div>
          </div>

          <div className="h-px" style={{ background: '#001161', opacity: 0.08 }} />

          <ul className="flex flex-col gap-2.5">
            {BASIC_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <div
                  className="rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ width: 20, height: 20, background: 'rgba(0,17,97,0.12)' }}
                >
                  <Check style={{ color: '#001161', width: 11, height: 11, opacity: 0.5 }} />
                </div>
                <span
                  className="text-[13px] leading-snug"
                  style={{ fontFamily: "'Fenomen Sans', sans-serif", color: '#001161' }}
                >
                  {f}
                </span>
              </li>
            ))}
          </ul>

          <p
            className="text-[11.5px] leading-snug pt-3"
            style={{
              fontFamily: "'Fenomen Sans', sans-serif",
              color: '#001161',
              opacity: 0.4,
              borderTop: '1px solid rgba(0,17,97,0.08)',
            }}
          >
            {'Pro školy automaticky od 15 ks sešitů. Pro rodiče dostupné jako předplatné.'}
          </p>
        </div>

        {/* KARTA 2 — Rozšířený přístup */}
        <div
          className="flex flex-col rounded-[24px] p-6 gap-4"
          style={{ background: '#7C3AED', border: '1.5px solid #7C3AED' }}
        >
          <div className="flex items-start gap-3">
            <span className="text-[30px] leading-none shrink-0 mt-0.5">⚡</span>
            <div>
              <p
                className="text-[11px] font-bold uppercase tracking-wider mb-0.5"
                style={{ fontFamily: "'Fenomen Sans', sans-serif", color: 'rgba(255,255,255,0.55)' }}
              >
                {'Rozšířený digitální přístup'}
              </p>
              <h3
                className="text-[17px] font-black leading-tight"
                style={{ fontFamily: "'Fenomen Sans', sans-serif", color: '#fff' }}
              >
                {'Digitální učebnice'}
              </h3>
            </div>
          </div>

          <div className="h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />

          {/* Všechny funkce */}
          <div>
            <ul className="flex flex-col gap-2.5">
              {FULL_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <div
                    className="rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ width: 18, height: 18, background: 'rgba(255,255,255,0.25)' }}
                  >
                    <Check style={{ color: '#fff', width: 10, height: 10 }} />
                  </div>
                  <span
                    className="text-[13px] leading-snug font-semibold"
                    style={{ fontFamily: "'Fenomen Sans', sans-serif", color: 'rgba(255,255,255,0.95)' }}
                  >
                    {f}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />

          {/* CTAs uvnitř karty */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onOrder}
              className="w-full inline-flex items-center justify-center gap-1.5 text-[13px] font-bold px-5 py-2.5 rounded-xl transition-all hover:opacity-90 cursor-pointer"
              style={{ fontFamily: "'Fenomen Sans', sans-serif", background: '#fff', color: '#7C3AED' }}
            >
              {'Poptávka pro školu'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <a
              href="/vyzkousejte"
              onClick={(e) => { e.preventDefault(); handlePredplatit(); }}
              className="w-full inline-flex items-center justify-center gap-1.5 text-[13px] font-bold px-5 py-2.5 rounded-xl transition-all hover:opacity-90 cursor-pointer"
              style={{
                fontFamily: "'Fenomen Sans', sans-serif",
                background: 'rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.9)',
                border: '1.5px solid rgba(255,255,255,0.2)',
              }}
            >
              {'Předplatit za 299 Kč / měsíc'}
            </a>
          </div>
        </div>

      </div>


    </div>
  );
}