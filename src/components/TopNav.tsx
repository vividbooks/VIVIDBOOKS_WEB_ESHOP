import { Phone } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useCart } from '../contexts/CartContext';
import { useSchoolOrderDraftMeta } from '../utils/schoolOrderDraft';
import { appUrl } from '../utils/publicSiteUrl';

interface TopNavProps {
  onOrder?: () => void;
}

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

const BTN_BASE =
  "flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-['Fenomen_Sans',sans-serif] text-[14px] font-bold whitespace-nowrap transition-all hover:scale-[1.03] active:scale-[0.97]";

export function TopNav({ onOrder }: TopNavProps) {
  const navigate = useNavigate();
  const { itemCount, toggleCart } = useCart();
  const { extraCount } = useSchoolOrderDraftMeta();
  const schoolOrderCount = itemCount + extraCount;

  return (
    <nav className="hidden md:flex fixed top-0 left-[245px] right-0 z-[55] bg-white border-b border-gray-100 h-14 items-center px-8 select-none">
      <div className="flex items-center gap-4 mx-auto">
        <Link
          to="/kontakt"
          className="flex items-center gap-2 text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold hover:text-[#ff6a35] transition-colors"
        >
          <Phone className="w-4 h-4" />
          <span>{'Zavolejte n\u00e1m: +420\u00a0602\u00a0227\u00a0674'}</span>
        </Link>

        <span className="w-px h-6 bg-[#001161]/10" />

        <a
          href="/vyzkousejte"
          onClick={(e) => {
            e.preventDefault();
            navigate('/vyzkousejte');
          }}
          className={`${BTN_BASE} bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-sm`}
        >
          {'Vyzkou\u0161et zdarma'}
        </a>

        <button onClick={onOrder} className={`${BTN_BASE} bg-[#3d3d3d] hover:bg-[#555] text-white`}>
          <span>Objednat pro školu</span>
          {schoolOrderCount > 0 && (
            <span
              style={FF}
              className="w-5 h-5 rounded-full bg-white text-[#3d3d3d] text-[11px] font-bold flex items-center justify-center"
            >
              {schoolOrderCount}
            </span>
          )}
        </button>

        {itemCount > 0 && (
          <button
            type="button"
            onClick={toggleCart}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-[14px] transition-all hover:scale-[1.03] active:scale-[0.97] shadow-[0_4px_14px_rgba(22,163,74,0.35)] cursor-pointer"
          >
            <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M3 3h2l.4 2M7 13h10l4-10H5.4M7 13L5.4 5M7 13l-1.5 6h11M10 19a1 1 0 100 2 1 1 0 000-2zm7 0a1 1 0 100 2 1 1 0 000-2z"
              />
            </svg>
            <span style={FF}>{'Ko\u0161\u00edk'}</span>
            <span
              style={FF}
              className="w-5 h-5 rounded-full bg-white text-[#16a34a] text-[11px] font-bold flex items-center justify-center"
            >
              {itemCount}
            </span>
          </button>
        )}

        <a
          href={appUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN_BASE} border border-[#001161] text-[#001161] hover:bg-[#001161] hover:text-white group`}
        >
          {'Otev\u0159\u00edt u\u010debnice'}
          <svg
            className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
    </nav>
  );
}
