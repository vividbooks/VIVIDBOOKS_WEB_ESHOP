import type { ReactNode } from 'react';
import { ApplePayMark, CardPaymentMark, GooglePayMark } from './paymentMethodIcons';

export type PaymentMethodCardOption = {
  id: string;
  label: string;
  description: string;
  priceLabel: string;
};

export function PaymentMethodSection({
  title = 'Platba',
  description,
  options,
  selectedId,
  onSelect,
  isOptionDisabled,
  notice,
  children,
}: {
  title?: string;
  description: string;
  options: PaymentMethodCardOption[];
  selectedId: string;
  onSelect?: (id: string) => void;
  isOptionDisabled?: (id: string) => boolean;
  notice?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-[#001161]/10 bg-white p-6 md:p-8">
      <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] leading-tight mb-3">
        {title}
      </h2>
      <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/60 leading-relaxed mb-6">
        {description}
      </p>
      {notice}
      <div className={children ? 'mb-6' : undefined}>
        <PaymentMethodCards
          options={options}
          selectedId={selectedId}
          onSelect={onSelect}
          isOptionDisabled={isOptionDisabled}
        />
      </div>
      {children}
    </div>
  );
}

export function PaymentMethodCards({
  options,
  selectedId,
  onSelect,
  isOptionDisabled,
}: {
  options: PaymentMethodCardOption[];
  selectedId: string;
  onSelect?: (id: string) => void;
  isOptionDisabled?: (id: string) => boolean;
}) {
  return (
    <div className="rounded-[20px] border border-[#001161]/10 overflow-hidden">
      {options.map((option, index) => {
        const isCard = option.id === 'card';
        const isDisabled = isOptionDisabled?.(option.id) ?? false;
        const isSelected = selectedId === option.id;

        return (
          <button
            key={option.id}
            type="button"
            disabled={isDisabled || !onSelect}
            onClick={() => {
              if (!isDisabled) onSelect?.(option.id);
            }}
            className={`w-full flex items-center justify-between gap-4 px-4 md:px-5 py-4 text-left ${
              index < options.length - 1 ? 'border-b border-[#001161]/8' : ''
            } ${isSelected ? 'bg-[#f8f9fc]' : 'bg-white'} ${isDisabled || !onSelect ? 'disabled:opacity-55 disabled:cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-1 inline-flex w-4 h-4 rounded-full border-2 ${
                  isSelected ? 'border-[#0ea5e9] bg-[#0ea5e9]' : 'border-[#001161]/25 bg-white'
                }`}
              />
              <div>
                <div className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161] uppercase">
                  {option.label}
                </div>
                <div className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/55 mt-1">
                  {option.description}
                </div>
                {isDisabled && !isCard && option.id !== 'transfer' && (
                  <div className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45 mt-1">
                    {'Na počítači je metoda jen informativní. Pokud ji Stripe podporuje, nabídne ji přímo ve formuláři na vhodném zařízení.'}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="inline-flex items-center justify-center min-w-[11rem] h-11 px-2 sm:px-3 rounded-[12px] border border-[#001161]/20 bg-white text-[#001161] font-['Fenomen_Sans',sans-serif] text-[15px] font-bold">
                {option.id === 'card' ? (
                  <div className="flex items-center gap-2">
                    <CardPaymentMark />
                    <span>{'Karta'}</span>
                  </div>
                ) : option.id === 'transfer' ? (
                  <span>{'Banka'}</span>
                ) : option.id === 'apple_pay' ? (
                  <ApplePayMark className="h-6 w-[5.5rem] shrink-0 text-[#001161]" />
                ) : (
                  <GooglePayMark className="h-6 w-[6.75rem] shrink-0" />
                )}
              </div>
              <div className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#65a30d] uppercase">
                {option.priceLabel}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
