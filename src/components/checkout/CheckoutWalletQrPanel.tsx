import React, { useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { absoluteAppUrl } from '../../utils/appBaseUrl';

/**
 * Odkaz pro dokončení platby na telefonu (/platit?resume= — stejné pro pokladnu i školní PI).
 */
export function walletResumeCheckoutUrl(resumeToken: string): string {
  return absoluteAppUrl(`platit?resume=${encodeURIComponent(resumeToken)}`);
}

export function CheckoutWalletQrPanel({
  resumeToken,
  walletKind,
}: {
  resumeToken: string;
  walletKind: 'apple_pay' | 'google_pay';
}) {
  const [copied, setCopied] = useState(false);
  const payUrl = useMemo(() => walletResumeCheckoutUrl(resumeToken), [resumeToken]);
  const title = walletKind === 'apple_pay' ? 'Apple Pay' : 'Google Pay';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-[20px] border border-[#001161]/10 bg-[#f8f9fc] p-6 md:p-8">
      <p className="font-['Fenomen_Sans',sans-serif] text-[15px] font-bold text-[#001161] mb-2">
        {`Zaplatit přes ${title} v telefonu`}
      </p>
      <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/70 leading-relaxed mb-5">
        {
          'Naskenujte QR kód fotoaparátem nebo aplikací banky. Otevře se jen stránka k platbě — dokončete na iPhonu (Apple Pay) nebo Androidu (Google Pay). Tato záložka na počítači se po zaplacení sama přesměruje na poděkování.'
        }
      </p>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-center">
        <div className="rounded-2xl bg-white p-4 border border-[#001161]/8 shadow-[0_4px_24px_rgba(0,17,97,0.06)]">
          <QRCode
            value={payUrl}
            size={200}
            level="M"
            fgColor="#001161"
            bgColor="#ffffff"
          />
        </div>
        <div className="flex flex-col gap-3 max-w-[280px] w-full">
          <button
            type="button"
            onClick={() => void copy()}
            className="w-full rounded-[14px] border border-[#001161]/18 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161] hover:bg-[#001161]/5 cursor-pointer transition-colors"
          >
            {copied ? 'Zkopírováno' : 'Zkopírovat odkaz'}
          </button>
          <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45 leading-snug break-all">
            {payUrl}
          </p>
        </div>
      </div>
    </div>
  );
}
