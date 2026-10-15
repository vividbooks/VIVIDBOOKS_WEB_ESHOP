import React, { useEffect, useState } from 'react';
import { publicAssetUrl } from '../utils/publicAssetUrl';

/**
 * „Jeden sešit, dvě podoby“ — skutečná stránka sešitu matematiky a to, co k ní učitel
 * dostane v aplikaci (řešení, metodika, minihra, Rýsování). Kolečka u úloh otevírají panel vpravo.
 */

type Kind = 'ok' | 'game' | 'info' | 'rys';
type Hotspot = { y: number; items: { t: Kind; id: string }[] };
type Page = { label: string; img: string; hs: Hotspot[] };
type Detail = {
  k: string;
  t: string;
  shot?: string;
  quote?: string;
  src?: string;
  steps?: string[];
  p?: string;
  tags?: string[];
};

const IMG = (f: string) => publicAssetUrl(`matematika-ukazka/${f}`);

const STAGES: Record<'1' | '2', { pages: Page[]; first: string; tiles: { img: string; b: string; s: string }[] }> = {
  '1': {
    pages: [
      {
        label: 'str. 16',
        img: IMG('p1.jpg'),
        hs: [
          { y: 9, items: [{ t: 'info', id: 'h0i' }] },
          { y: 57.5, items: [{ t: 'game', id: 'h1g' }, { t: 'info', id: 'h1i' }] },
        ],
      },
      {
        label: 'str. 17',
        img: IMG('p2.jpg'),
        hs: [
          { y: 6, items: [{ t: 'info', id: 'h2i' }] },
          { y: 17.8, items: [{ t: 'game', id: 'h3g' }, { t: 'info', id: 'h3i' }] },
          { y: 31.2, items: [{ t: 'info', id: 'h4i' }] },
        ],
      },
    ],
    first: 'h1g',
    tiles: [
      { img: IMG('hra-vzor.jpg'), b: 'Minihry u úloh', s: 'Ke kapitole Tři je jich pět, každá nastavená jen na čísla, která žáci už znají.' },
      { img: publicAssetUrl('aplikace/news-07-pocetnik.png'), b: 'Početník', s: 'Krátké procvičování počítání ke kapitole, na tabuli i v tabletech.' },
      { img: publicAssetUrl('aplikace/news-05-nastenka.png'), b: 'Matematická tabule', s: 'Kostky, žetony a čísla, se kterými žáci pracují u tabule.' },
    ],
  },
  '2': {
    pages: [
      {
        label: 'str. 46',
        img: IMG('k1.jpg'),
        hs: [
          { y: 34.4, items: [{ t: 'rys', id: 'k0r' }] },
          { y: 43.9, items: [{ t: 'ok', id: 'k1o' }, { t: 'info', id: 'k1i' }] },
          { y: 64, items: [{ t: 'ok', id: 'k2o' }] },
        ],
      },
    ],
    first: 'k1o',
    tiles: [
      { img: IMG('rysovani.jpg'), b: 'Aplikace Rýsování', s: 'U rýsovacích úloh záznam konstrukce krok po kroku se zápisem ve školní notaci.' },
      { img: publicAssetUrl('aplikace/news-07-pocetnik.png'), b: 'Procvičování', s: 'Příklady k tématu v několika úrovních. Žák vidí, kolik má správně.' },
      { img: publicAssetUrl('aplikace/news-05-nastenka.png'), b: 'Vlastní tabule', s: 'Z jakékoli stránky si uděláte tabuli a dopíšete do ní vlastní úlohy.' },
    ],
  },
};

const DETAILS: Record<string, Detail> = {
  h0i: { k: 'Úvod kapitoly', t: 'Jak začít hodinu', quote: 'Který medvěd je největší, který je nejmenší? Používáme slova vlevo, vpravo, uprostřed. Kterému medvědovi asi patří modrá miska?', src: 'Metodická poznámka k úvodnímu obrázku' },
  h1g: { k: 'Úkol 1 · Hledej 3', t: 'Minihra „Poznej čísla“', shot: IMG('hra-pocet.jpg'), p: 'Žlutým kolečkem pustíte hru přímo na tabuli. Je nastavená jen na čísla 1 až 3, protože víc žáci v této kapitole ještě neznají.', tags: ['čísla 1–3', 'puntíky i obrázky', 'na tabuli i v tabletu'] },
  h1i: { k: 'Úkol 1 · Hledej 3', t: 'Metodika k úloze', quote: 'Hledáme ve třídě, kde všude můžeme vidět počet 3. Teprve pak prohlížíme obrázky. Diskutujeme.', src: 'Metodická poznámka u úlohy' },
  h2i: { k: 'Úkol 2 · Postav a pokračuj', t: 'Metodika k úloze', quote: 'Postavíme řadu z krychlí. Zachováváme pravidelnost. Jak bude řada pokračovat? Proč? Zakreslíme.', src: 'Metodická poznámka u úlohy' },
  h3g: { k: 'Úkol 3 · Pokračuj', t: 'Minihra „Doplň vzor“', shot: IMG('hra-vzor.jpg'), p: 'Stejná pravidelnost jako v sešitu, jen ji žáci doplňují přetahováním na tabuli. Každé kolo je nové, takže hra vydrží celou třídu.', tags: ['pravidelnost AAB', 'přetahování', 'nové kolo na klepnutí'] },
  h3i: { k: 'Úkol 3 · Pokračuj', t: 'Metodika k úloze', quote: 'Pokračujeme v pravidelnosti typu AAABBB na obě strany.', src: 'Metodická poznámka u úlohy' },
  h4i: { k: 'Úkol 4 · Postav další a vybarvi', t: 'Metodika k úloze', quote: 'Stavíme věže ze tří krychlí dvou barev. Hledáme různé možnosti. Zaznamenáme je vybarvením.', src: 'Metodická poznámka u úlohy' },
  k0r: { k: 'Kapitola Úhly v trojúhelníku', t: 'Jak se to rýsuje', shot: IMG('rysovani.jpg'), p: 'Rýsovací úlohy mají pod zelenou fajfkou ikonu pravítka. Otevře se aplikace Rýsování a konstrukce se přehraje krok po kroku, se zápisem, jaký žáci píšou do sešitu.', tags: ['krok vpřed a zpět', 'zápis konstrukce', 'varianty A–D'] },
  k1o: { k: 'Úkol 1 · Změř úhly', t: 'Řešení po krocích', steps: ['první úhel', 'druhý úhel', 'shrnutí: vnitřní a vnější úhel'], p: 'Zelenou fajfkou odkrýváte řešení postupně. Třída nejdřív měří sama, pak porovná s řešením na tabuli.' },
  k1i: { k: 'Úkol 1 · Změř úhly', t: 'Metodika k úloze', quote: 'Úkol vede k uvědomění, že vnitřní a vnější úhel jsou vedlejší úhly a jejich součet je tím pádem vždy 180°.', src: 'Metodická inspirace u úlohy' },
  k2o: { k: 'Úkol 2 · Změř a zapiš', t: 'Řešení na tabuli', steps: ['velikosti úhlů A–D', 'úlohy s hvězdičkou E, F'], p: 'Řešení každé úlohy je přímo na stránce. Úlohy s hvězdičkou pro rychlejší žáky odkryjete zvlášť.' },
};

const KIND_STYLE: Record<Kind, { bg: string; fg: string; border: string; icon: string; label: string }> = {
  ok: { bg: '#10b981', fg: '#fff', border: '#fff', icon: '✓', label: 'Řešení' },
  info: { bg: '#5b4fd8', fg: '#fff', border: '#fff', icon: 'i', label: 'Metodika' },
  game: { bg: '#ffd23f', fg: '#001161', border: '#fff', icon: '★', label: 'Minihra' },
  rys: { bg: '#fff', fg: '#5b4fd8', border: '#5b4fd8', icon: '△', label: 'Rýsování' },
};

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

function Steps({ steps }: { steps: string[] }) {
  const [shown, setShown] = useState(1);
  useEffect(() => setShown(1), [steps]);
  const done = shown >= steps.length;
  return (
    <div className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const on = i < shown;
        return (
          <div
            key={s}
            className={`flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-[14px] font-semibold transition-colors ${on ? 'border-[#10b981] bg-[#e6f7f0]' : 'border-[#001161]/10 bg-white'}`}
          >
            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${on ? 'bg-[#10b981] text-white' : 'bg-[#eef0f6] text-[#001161]/40'}`}>
              {String.fromCharCode(65 + i)}
            </span>
            {s}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => setShown(done ? 1 : shown + 1)}
        className="self-start mt-1 rounded-[12px] bg-[#5b4fd8] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#4c40c7] cursor-pointer"
      >
        {done ? 'Začít znovu' : 'Ukázat další krok'}
      </button>
    </div>
  );
}

export function MathOnePageTwoForms({ stage }: { stage: '1' | '2' }) {
  const cfg = STAGES[stage];
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(cfg.first);
  const [app, setApp] = useState(true);
  const pg = cfg.pages[page] ?? cfg.pages[0];
  const d = DETAILS[sel];

  return (
    <section className="px-6 md:px-12 py-14 bg-[#fafbfe]" style={{ color: '#001161' }}>
      <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-[640px]">
            <p style={FF} className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#5b4fd8]">
              {'Co dostanete k pracovnímu sešitu'}
            </p>
            <h2 className="mt-2 leading-[1.05]" style={{ fontFamily: "'Cooper Light', serif", fontSize: 'clamp(30px, 4vw, 44px)' }}>
              {'Jeden sešit, dvě podoby'}
            </h2>
            <p style={FF} className="mt-3 text-[15px] leading-relaxed text-[#001161]/70">
              {'Žáci píšou do sešitu. Vy máte stejnou stránku v aplikaci, na tabuli i v tabletech žáků. U každé úlohy je řešení, metodika a často i minihra nebo záznam konstrukce.'}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <span style={FF} className="inline-flex items-center gap-2 rounded-full bg-[#e6f7f0] px-4 py-2 text-[13px] font-bold text-[#0b7a55]">
              {'✓ V ceně sešitů, pro školy od 15 ks'}
            </span>
            <div style={FF} className="inline-flex rounded-full border border-[#001161]/10 bg-white p-1" role="group" aria-label="Podoba stránky">
              {[
                { v: false, l: 'Sešit žáka' },
                { v: true, l: 'V aplikaci' },
              ].map(o => (
                <button
                  key={o.l}
                  type="button"
                  aria-pressed={app === o.v}
                  onClick={() => setApp(o.v)}
                  className={`rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer transition-colors ${app === o.v ? 'bg-[#5b4fd8] text-white' : 'text-[#001161]/60'}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-8 items-start">
          <div className="rounded-[20px] bg-[#eceef6] p-4 flex flex-col gap-3">
            <div style={FF} className="flex justify-center gap-2">
              {cfg.pages.length > 1 ? (
                cfg.pages.map((p, i) => (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={i === page}
                    onClick={() => {
                      setPage(i);
                      setSel(p.hs[0].items[0].id);
                    }}
                    className={`rounded-full border bg-white px-3 py-1.5 text-[12px] font-bold cursor-pointer ${i === page ? 'border-[#001161] text-[#001161]' : 'border-[#001161]/10 text-[#001161]/50'}`}
                  >
                    {p.label}
                  </button>
                ))
              ) : (
                <span className="text-[12px] text-[#001161]/45">{pg.label}</span>
              )}
            </div>
            <div className="relative mx-auto w-full max-w-[520px] rounded-[6px] shadow-[0_10px_26px_-16px_rgba(0,17,97,0.55)]">
              <img src={pg.img} alt={`Stránka pracovního sešitu, ${pg.label}`} className="block w-full h-auto rounded-[6px]" />
              <div className={`absolute inset-0 transition-opacity duration-200 ${app ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {pg.hs.map(h => (
                  <div key={h.y} className="absolute -right-3 flex -translate-y-1/2 flex-col gap-1.5" style={{ top: `${h.y}%` }}>
                    {h.items.map(it => {
                      const k = KIND_STYLE[it.t];
                      const active = sel === it.id;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          tabIndex={app ? 0 : -1}
                          aria-pressed={active}
                          aria-label={`${k.label}: ${DETAILS[it.id].k}`}
                          onClick={() => setSel(it.id)}
                          className="grid size-[34px] place-items-center rounded-full border-[3px] text-[15px] font-bold cursor-pointer transition-transform hover:scale-110"
                          style={{
                            background: k.bg,
                            color: k.fg,
                            borderColor: k.border,
                            fontFamily: it.t === 'info' ? 'Georgia, serif' : undefined,
                            fontStyle: it.t === 'info' ? 'italic' : undefined,
                            boxShadow: active ? '0 0 0 4px #001161, 0 4px 10px rgba(0,17,97,.3)' : '0 4px 10px rgba(0,17,97,.3)',
                          }}
                        >
                          {k.icon}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {app && (
              <div style={FF} className="flex flex-wrap justify-center gap-4 text-[12px] font-semibold text-[#001161]/70">
                {(['ok', 'info', 'game', 'rys'] as Kind[]).map(k => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <i className="inline-block size-4 rounded-full border-2" style={{ background: KIND_STYLE[k].bg, borderColor: k === 'rys' ? '#5b4fd8' : KIND_STYLE[k].bg }} />
                    {KIND_STYLE[k].label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={FF} className="flex flex-col gap-4 min-w-0" aria-live="polite">
            {app && d ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#001161]/40">{d.k}</p>
                <h3 className="leading-tight" style={{ fontFamily: "'Cooper Light', serif", fontSize: 28 }}>{d.t}</h3>
                {d.shot && (
                  <div className="overflow-hidden rounded-[14px] border border-[#001161]/10 bg-white shadow-[0_10px_24px_-18px_rgba(0,17,97,0.5)]">
                    <img src={d.shot} alt={d.t} className="block w-full h-auto" />
                  </div>
                )}
                {d.quote && (
                  <div className="rounded-[14px] bg-[#eeecfd] px-5 py-4 text-[15px] leading-relaxed">
                    {`„${d.quote}“`}
                    <span className="mt-2 block text-[12px] font-semibold text-[#001161]/45">{d.src}</span>
                  </div>
                )}
                {d.steps && <Steps steps={d.steps} />}
                {d.p && <p className="text-[15px] leading-relaxed text-[#001161]/70">{d.p}</p>}
                {d.tags && (
                  <div className="flex flex-wrap gap-1.5">
                    {d.tags.map(t => (
                      <span key={t} className="rounded-full bg-[#f0f1f8] px-2.5 py-1 text-[12px] font-semibold text-[#001161]/70">{t}</span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#001161]/40">{'Sešit žáka'}</p>
                <h3 className="leading-tight" style={{ fontFamily: "'Cooper Light', serif", fontSize: 28 }}>{'Tohle má žák v lavici'}</h3>
                <p className="text-[15px] leading-relaxed text-[#001161]/70">
                  {'Tištěná stránka, do které se píše. Přepněte na „V aplikaci“ a uvidíte, co k ní máte vy.'}
                </p>
              </>
            )}
          </div>
        </div>

        <div>
          <p style={FF} className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#5b4fd8]">{'A ke každé kapitole navíc'}</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {cfg.tiles.map(t => (
              <div key={t.b} className="overflow-hidden rounded-[16px] border border-[#001161]/10 bg-white">
                <div className="aspect-[16/10] overflow-hidden bg-[#232a3b]">
                  <img src={t.img} alt={t.b} className="h-full w-full object-cover" />
                </div>
                <div style={FF} className="flex flex-col gap-1 px-4 py-3.5">
                  <b className="text-[15px]">{t.b}</b>
                  <span className="text-[13px] leading-snug text-[#001161]/65">{t.s}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
