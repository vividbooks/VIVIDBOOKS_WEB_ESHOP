import React from 'react';
import { useNavigate } from 'react-router';
import { SEOHead } from './SEOHead';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <SEOHead
        title="Str\u00e1nka nenalezena"
        noIndex={true}
        description="Str\u00e1nka, kterou hled\u00e1te, neexistuje nebo byla p\u0159esunuta."
      />
      <div className="text-center">
        <p className="font-['Cooper_Light',serif] text-[#001161] text-[80px] leading-none mb-4 opacity-20">404</p>
        <p className="font-['Cooper_Light',serif] text-[#001161] text-[32px] mb-6">
          {'Str\u00e1nka nebyla nalezena'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 bg-[#001161] text-white px-6 py-3 rounded-[14px] font-['Fenomen_Sans',sans-serif] text-[15px] font-bold cursor-pointer hover:bg-[#000a3d] transition-colors"
        >
          {'Zp\u011bt do katalogu'}
        </button>
      </div>
    </div>
  );
}