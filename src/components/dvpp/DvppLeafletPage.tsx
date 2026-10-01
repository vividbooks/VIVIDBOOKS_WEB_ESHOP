/**
 * /sborovna/letacek?code= — A4 letáček s QR kódem na nástěnku do sborovny (tisk z prohlížeče).
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { dvppApi } from '../../utils/dvppApi';

export function DvppLeafletPage() {
  const [sp] = useSearchParams();
  const code = (sp.get('code') || '').toUpperCase();
  const [school, setSchool] = useState<string>('');
  const [target, setTarget] = useState<number | null>(null);
  const url = `https://dvppzdarma.cz/s/${code}`;

  useEffect(() => {
    if (!code) return;
    dvppApi.previewStaffroom(code).then((p) => { setSchool(p.school?.name || ''); setTarget(p.target); }).catch(() => {});
    document.title = `Letáček sborovny ${code}`;
  }, [code]);

  return (
    <div className="min-h-screen bg-white p-10 text-[#0d1440]" style={{ fontFamily: "'Fenomen Sans', Arial, sans-serif" }}>
      <style>{`@media print { .no-print { display: none } body { margin: 0 } }`}</style>
      <div className="no-print mb-6 flex gap-3">
        <button type="button" onClick={() => window.print()} className="rounded-full bg-[#001161] px-5 py-2 text-[14px] font-bold text-white">Vytisknout</button>
        <a href="/sborovna" className="rounded-full border border-[#001161]/20 px-5 py-2 text-[14px] font-bold text-[#001161] no-underline">Zpět do sborovny</a>
      </div>
      <div className="mx-auto max-w-[720px] rounded-[24px] border-4 border-[#001161] p-10 text-center">
        <p className="mb-2 text-[14px] font-bold uppercase tracking-[.2em] text-[#F06632]">DVPP zdarma pro naši sborovnu</p>
        <h1 className="mb-3 text-[40px] font-extrabold leading-tight text-[#001161]">Záznamy webinářů s osvědčením DVPP. Zdarma.</h1>
        {school ? <p className="mb-6 text-[20px] text-[#3a4270]">{school}</p> : null}
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`} alt={`QR kód ${url}`} width={280} height={280} className="mx-auto mb-4" />
        <p className="mb-1 text-[18px] text-[#3a4270]">Naskenujte, nebo napište</p>
        <p className="mb-6 text-[26px] font-extrabold text-[#001161]">dvppzdarma.cz/s/{code}</p>
        <ol className="mx-auto max-w-[520px] space-y-2 text-left text-[16px] text-[#3a4270]">
          <li>1. Přihlásíte se e-mailem, bez hesla.</li>
          <li>2. Pustíte si záznam a po 4 otázkách máte osvědčení DVPP.</li>
          <li>3. Až se nás přidá {target ?? 'třetina sboru'}{target ? ' kolegů' : ''}, má knihovnu zdarma celá škola.</li>
        </ol>
        <p className="mt-8 text-[12px] text-[#6b7398]">Vividbooks s.r.o. · osvědčení podle § 10 vyhlášky 317/2005 Sb. · hello@vividbooks.com</p>
      </div>
    </div>
  );
}
