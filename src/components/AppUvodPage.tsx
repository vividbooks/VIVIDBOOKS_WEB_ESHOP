import React from 'react';
import { SEOHead } from './SEOHead';

/** Samostatná úvodní stránka pro embed v app.vividbooks.com (/app-uvod). */
export function AppUvodPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-white px-4">
      <SEOHead
        title="Vítejte ve Vividbooks"
        description="Vítejte ve Vividbooks."
        noIndex
      />
      <p className="font-['Cooper_Light',serif] text-[#001161] text-[28px] md:text-[36px] text-center">
        Vítejte ve Vividbooks
      </p>
    </div>
  );
}
