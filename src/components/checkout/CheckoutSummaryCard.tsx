import React from 'react';
import { formatPrice } from './formatPrice';

export function CheckoutSummaryCard({
  itemCount,
  subtotal,
  shippingTotal,
  total,
  showShipping,
  resumeOrderNumber,
}: {
  itemCount: number;
  subtotal: number;
  shippingTotal: number;
  total: number;
  showShipping: boolean;
  /** Když uživatel dokončuje platbu z e-mailového odkazu (košík nemusí sedět). */
  resumeOrderNumber?: string | null;
}) {
  const grandTotal = showShipping ? total : subtotal;

  return (
    <div className="rounded-[18px] border border-[#001161]/10 bg-white p-4 shadow-sm">
      <p className="font-['Fenomen_Sans',sans-serif] text-[11px] uppercase tracking-[0.12em] text-[#001161]/40 mb-3">
        {'Shrnut\u00ed'}
      </p>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[13px] font-['Fenomen_Sans',sans-serif]">
          <span className="text-[#001161]/55">
            {resumeOrderNumber ? 'Objednávka' : 'Počet kusů'}
          </span>
          <span className="font-bold text-[#001161]">
            {resumeOrderNumber ?? itemCount}
          </span>
        </div>
        <div className="flex items-center justify-between text-[13px] font-['Fenomen_Sans',sans-serif]">
          <span className="text-[#001161]/55">{'Mezisou\u010det'}</span>
          <span className="font-bold text-[#001161]">{formatPrice(subtotal)}</span>
        </div>
        {showShipping && (
          <div className="flex items-center justify-between text-[13px] font-['Fenomen_Sans',sans-serif]">
            <span className="text-[#001161]/55">{'Doprava'}</span>
            <span className="font-bold text-[#001161]">{formatPrice(shippingTotal)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[13px] font-['Fenomen_Sans',sans-serif] pt-2.5 border-t border-[#001161]/10">
          <span className="text-[#001161]/55">{'Celkem'}</span>
          <span className="font-bold text-[#001161]">{formatPrice(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
