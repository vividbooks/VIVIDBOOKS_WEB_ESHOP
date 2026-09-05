/**
 * Řady a nejsledovanější záznamy pro landing dvppzdarma.cz (bez přihlášení; data z GET /dvpp/catalog).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Award, ChevronRight } from 'lucide-react';
import { dvppApi, type DvppCatalog } from '../../utils/dvppApi';
import { DvppSessionProvider } from './DvppSession';
import { dvppToneVars } from './DvppShell';
import { TopicsVoting, VideoRow } from './DvppLibraryPage';

function Inner() {
  const [catalog, setCatalog] = useState<DvppCatalog | null>(null);
  useEffect(() => { dvppApi.catalog().then(setCatalog).catch(() => {}); }, []);
  if (!catalog) return null;
  const seriesRows = catalog.rows.filter((r) => r.key.startsWith('series:'));
  const top = catalog.rows.find((r) => r.key === 'top');
  if (!seriesRows.length && !top) return null;
  return (
    <section id="rady" className="mx-auto max-w-7xl px-5 py-14 md:px-8" style={{ ...dvppToneVars('light'), fontFamily: "'Fenomen Sans', sans-serif" }}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[12px] font-black uppercase tracking-[0.18em] text-[#E8942A]">Knihovna pro sborovny</p>
          <h2 className="font-['Cooper_Light',serif] text-[28px] leading-none text-black md:text-[36px]">Řady, které dávají 8 hodin DVPP</h2>
        </div>
        <Link to="/knihovna" className="inline-flex items-center gap-1 rounded-full bg-[#001161] px-5 py-2.5 text-[13px] font-black text-white no-underline">Otevřít celou knihovnu <ChevronRight className="h-4 w-4" /></Link>
      </div>
      <div className="-mx-4 md:-mx-10">
        {seriesRows.map((r) => <VideoRow key={r.key} title={r.title} subtitle={r.subtitle} videos={r.videos} guest />)}
        {top ? <VideoRow title={top.title} videos={top.videos} guest /> : null}
      </div>
      <div className="mt-2 grid gap-4 md:grid-cols-3">
        {[
          ['Tři záznamy hned', 'Přihlášení e-mailem, bez hesla. Prvních 10 minut každého záznamu je bez přihlášení.'],
          ['Osvědčení po 4 otázkách', 'Číslo, rozsah hodin, lektor. Podle § 10 vyhlášky 317/2005 Sb., vykazatelné v šablonách.'],
          ['Celá sborovna zdarma', 'Když se přidá třetina sboru, má knihovnu každý učitel školy. Ředitel to zvládne jedním kódem.'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-[18px] border border-[#001161]/10 bg-white p-5">
            <Award className="mb-2 h-5 w-5 text-[#F06632]" />
            <p className="text-[15px] font-black text-[#001161]">{t}</p>
            <p className="text-[13px] text-[#3a4270]">{d}</p>
          </div>
        ))}
      </div>
      <div className="mt-10"><TopicsVoting padded={false} /></div>
    </section>
  );
}

export function DvppSeriesShowcase() {
  return <DvppSessionProvider><Inner /></DvppSessionProvider>;
}
