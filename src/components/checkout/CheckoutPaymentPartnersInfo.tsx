import React from 'react';
import { publicAssetUrl } from '../../utils/publicAssetUrl';

const CENTRALPAY_HOME = 'https://www.centralpay.eu/';

/**
 * Informace o digitálních peněženkách (Stripe Payment Element) a odkaz na partnera CentralPay.
 * Logo: oficiální barevné logo z brand materiálů (public/checkout/centralpay-logo.png).
 */
export function CheckoutPaymentPartnersInfo({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-[18px] border border-[#001161]/10 bg-[#f8f9fc]/80 px-4 py-4 md:px-5 md:py-5 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <a
          href={CENTRALPAY_HOME}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 self-start sm:pt-0.5"
          aria-label="CentralPay — otevřít web"
        >
          <img
            src={publicAssetUrl('checkout/centralpay-logo.png')}
            alt="CentralPay"
            className="h-10 w-auto max-w-[200px] object-contain object-left"
            width={200}
            height={40}
            loading="lazy"
          />
        </a>
        <div className="min-w-0 space-y-2 font-['Fenomen_Sans',sans-serif] text-[12px] md:text-[13px] text-[#001161]/75 leading-relaxed">
          <p>
            <strong className="text-[#001161]">Apple Pay a Google Pay</strong>
            {' '}
            se v platebním formuláři zobrazí automaticky tam, kde je váš prohlížeč a Stripe podporují
            (typicky Safari na iPhonu/Macu nebo Chrome s uloženou kartou). Na počítači může Apple Pay
            nabídnout i platbu přes{' '}
            <strong className="text-[#001161]">QR kód</strong>
            {' '}
            — naskenujete ho iPhonem a potvrdíte Face ID / Touch ID.
          </p>
          <p className="text-[#001161]/65">
            Samotná platba u nás běží přes{' '}
            <strong className="text-[#001161]/80">Stripe</strong>. CentralPay je nezávislá evropská
            platební instituce (EMI); níže odkaz na jejich článek o Apple Pay přes QR:{' '}
            <a
              href="https://www.centralpay.com/en/blog/apple-pay-via-qr-code-simplify-online-payments/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5b4fd8] underline underline-offset-2 hover:opacity-80"
            >
              Apple Pay via QR Code — článek (EN)
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
