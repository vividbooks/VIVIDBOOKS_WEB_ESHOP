import React, { useMemo } from 'react';
import { Link } from 'react-router';
import { useProducts } from '../contexts/ProductsContext';
import { SEOHead } from './SEOHead';
import { productDetailPath } from '../utils/slugify';
import { RELEASE_PLAN_PATH } from '../config/releasePlan';

/**
 * Interní časová osa vydání nových titulů po předmětech. Bere neveřejné produkty (`unpublished`)
 * z katalogu a měsíc vydání ze štítku „Dostupné v prosinci 2026“ (`note`), takže změna termínu
 * v adminu se tu projeví sama.
 */

const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
/** 6. pád z poznámky („v prosinci“) → číslo měsíce 0–11. */
const LOCATIVE: Record<string, number> = {
  lednu: 0, únoru: 1, březnu: 2, dubnu: 3, květnu: 4, červnu: 5, červenci: 6, srpnu: 7, září: 8, říjnu: 9, listopadu: 10, prosinci: 11,
};

const STAGE_1 = ['Matematika 1. stupeň', 'Český jazyk', 'Prvouka', 'Vlastivěda', 'Přírodověda', 'Informatika'];
const SUBJECT_ORDER = [...STAGE_1, 'Matematika 2. stupeň', 'Fyzika', 'Chemie', 'Přírodopis', 'Dějepis', 'Zeměpis'];

type Release = { product: any; month: number | null };

function releaseMonth(note: unknown): number | null {
  const m = String(note || '').match(/Dostupné v\s+(\S+)\s+(\d{4})/i);
  if (!m) return null;
  const month = LOCATIVE[m[1].toLowerCase()];
  return month === undefined ? null : Number(m[2]) * 12 + month;
}

const monthLabel = (index: number) => ({ name: MONTHS[index % 12], year: Math.floor(index / 12) });
const subjectLabel = (category: string) => category.replace(/\s*\d\.\s*stupeň$/i, '');
const plural = (n: number) => (n === 1 ? 'titul' : n >= 2 && n <= 4 ? 'tituly' : 'titulů');

export function ReleasePlanPage() {
  const { products, isLoading } = useProducts();

  const { months, groups, undated, counts } = useMemo(() => {
    const releases: Release[] = (products || [])
      .filter((p: any) => p?.unpublished === true)
      .map((p: any) => ({ product: p, month: releaseMonth(p.note) }));
    const dated = releases.filter((r) => r.month !== null) as { product: any; month: number }[];
    const first = Math.min(...dated.map((r) => r.month));
    const last = Math.max(...dated.map((r) => r.month));
    const months = dated.length ? Array.from({ length: last - first + 1 }, (_, i) => first + i) : [];
    const counts = new Map<number, number>();
    for (const r of dated) counts.set(r.month, (counts.get(r.month) || 0) + 1);

    const bySubject = new Map<string, { product: any; month: number }[]>();
    for (const r of dated) {
      const key = String(r.product.category || 'Ostatní');
      bySubject.set(key, [...(bySubject.get(key) || []), r]);
    }
    const rank = (c: string) => (SUBJECT_ORDER.indexOf(c) + 1 || 99);
    const groups = [...bySubject.entries()]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([category, items]) => ({
        category,
        stage: STAGE_1.includes(category) ? 1 : 2,
        items: items.sort((a, b) => a.month - b.month || String(a.product.name).localeCompare(String(b.product.name), 'cs', { numeric: true })),
      }))
      // Nadpis stupně jen u prvního předmětu daného stupně.
      .map((group, index, all) => ({ ...group, showStage: index === 0 || all[index - 1].stage !== group.stage }));
    const undated = releases.filter((r) => r.month === null).map((r) => r.product);
    return { months, groups, undated, counts };
  }, [products]);

  const gridColumns = `minmax(180px, 320px) repeat(${Math.max(months.length, 1)}, minmax(64px, 1fr))`;

  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 py-10 md:px-10">
      <SEOHead title="Plán vydání" path={RELEASE_PLAN_PATH} noIndex />
      <div className="mx-auto grid max-w-[1180px] gap-7">
        <header>
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#5d6585]">Vividbooks · interní</p>
          <h1 className="mt-1 font-['Fenomen_Sans',sans-serif] text-[34px] font-bold leading-tight text-[#001161] md:text-[44px]">
            Plán vydání sešitů a učebnic
          </h1>
          <p className="mt-2 max-w-[64ch] text-[#5d6585]">
            Kdy vyjdou připravené tituly, po předmětech. Termín bere stránka ze štítku „Dostupné v …“ u produktu v adminu.
          </p>
        </header>

        {isLoading && months.length === 0 ? (
          <p className="text-[#5d6585]">Načítám katalog…</p>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-2 md:grid-cols-6" aria-label="Počet titulů po měsících">
              {months.map((m) => {
                const { name, year } = monthLabel(m);
                const n = counts.get(m) || 0;
                return (
                  <div key={m} className="grid gap-0.5 rounded-[10px] border border-[#dfe3ee] bg-white px-3 py-2.5">
                    <span className="text-[12px] capitalize text-[#5d6585]">{name} {year}</span>
                    <b className="text-[26px] leading-none tabular-nums text-[#001161]">{n}</b>
                    <span className="text-[12px] text-[#5d6585]">{plural(n)}</span>
                  </div>
                );
              })}
            </section>

            <div className="flex flex-wrap gap-4 text-[13px] text-[#5d6585]">
              <span><i className="mr-1.5 inline-block h-2.5 w-6 rounded-full bg-[#0f8a7e] align-middle" />1. stupeň</span>
              <span><i className="mr-1.5 inline-block h-2.5 w-6 rounded-full bg-[#3b45c4] align-middle" />2. stupeň</span>
            </div>

            <div className="overflow-x-auto rounded-[14px] border border-[#dfe3ee] bg-white">
              <div className="grid min-w-[720px]" style={{ gridTemplateColumns: gridColumns }} role="table" aria-label="Časová osa vydání">
                <div className="border-b border-[#dfe3ee] px-4 py-3 text-[12px] font-bold text-[#5d6585]" role="columnheader">Titul</div>
                {months.map((m) => {
                  const { name, year } = monthLabel(m);
                  return (
                    <div key={m} className="border-b border-[#dfe3ee] px-2 py-3 text-center text-[12px] font-bold capitalize text-[#5d6585]" role="columnheader">
                      {name}
                      <span className="block font-normal">{year}</span>
                    </div>
                  );
                })}
                {groups.map((group) => (
                  <React.Fragment key={group.category}>
                    {group.showStage && (
                      <div className="px-4 pb-1.5 pt-4 text-[18px] font-bold text-[#001161]" style={{ gridColumn: '1 / -1' }}>
                        {group.stage}. stupeň
                      </div>
                    )}
                    <div className="border-t border-[#dfe3ee] px-4 pb-1 pt-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#5d6585]" style={{ gridColumn: '1 / -1' }}>
                      {subjectLabel(group.category)}
                    </div>
                    {group.items.map(({ product, month }) => (
                      <React.Fragment key={product.id}>
                        <div className="flex min-w-0 items-center py-1 pl-4 pr-2 text-[14px]" role="rowheader">
                          <Link to={productDetailPath(product, products)} className="text-[#141a3a] hover:underline">{product.name}</Link>
                        </div>
                        {months.map((m) => (
                          <div key={m} className="flex items-center border-l border-dashed border-[#dfe3ee] px-1 py-1" role="cell">
                            {m === month && (
                              <div
                                className={`h-5 w-full rounded-md ${group.stage === 1 ? 'bg-[#0f8a7e]' : 'bg-[#3b45c4]'}`}
                                title={`${product.name} — ${product.note}`}
                              />
                            )}
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {undated.length > 0 && (
              <section className="grid gap-2 rounded-[12px] border border-[#dfe3ee] bg-white px-5 py-4">
                <h2 className="text-[18px] font-bold text-[#001161]">Bez termínu</h2>
                <ul className="grid list-disc gap-1 pl-5 text-[14px]">
                  {undated.map((p) => (
                    <li key={p.id}><Link to={productDetailPath(p, products)} className="hover:underline">{p.name}</Link></li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
