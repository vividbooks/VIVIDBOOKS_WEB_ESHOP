import React from 'react';

export type HeroLayoutVisualValue =
  | 'center'
  | 'left-text'
  | 'left-image'
  | 'full-image'
  | 'text-products'
  | 'text-products-below'
  | 'products-text-below';

const FRAME = { x: 3, y: 3, w: 58, h: 34, rx: 3 } as const;

function SlideFrame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 40"
      className="h-10 w-16 shrink-0"
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x={FRAME.x}
        y={FRAME.y}
        width={FRAME.w}
        height={FRAME.h}
        rx={FRAME.rx}
        stroke="currentColor"
        strokeWidth={1.25}
        className="text-white/45"
      />
      {children}
    </svg>
  );
}

function IconTextProductsBelow() {
  return (
    <SlideFrame>
      <g className="text-white/80" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round">
        <line x1={20} y1={10} x2={44} y2={10} />
        <line x1={22} y1={15} x2={42} y2={15} />
        <line x1={18} y1={20} x2={46} y2={20} />
      </g>
      <rect x={14} y={26} width={10} height={7} rx={0.5} className="text-white/45" stroke="currentColor" strokeWidth={1} fill="currentColor" fillOpacity={0.12} />
      <rect x={27} y={26} width={10} height={7} rx={0.5} className="text-white/45" stroke="currentColor" strokeWidth={1} fill="currentColor" fillOpacity={0.12} />
      <rect x={40} y={26} width={10} height={7} rx={0.5} className="text-white/45" stroke="currentColor" strokeWidth={1} fill="currentColor" fillOpacity={0.12} />
    </SlideFrame>
  );
}

/** Zrcadlo: obálky nahoře, textové řádky dole. */
function IconProductsTextBelow() {
  return (
    <SlideFrame>
      <rect x={14} y={7} width={10} height={7} rx={0.5} className="text-white/45" stroke="currentColor" strokeWidth={1} fill="currentColor" fillOpacity={0.12} />
      <rect x={27} y={7} width={10} height={7} rx={0.5} className="text-white/45" stroke="currentColor" strokeWidth={1} fill="currentColor" fillOpacity={0.12} />
      <rect x={40} y={7} width={10} height={7} rx={0.5} className="text-white/45" stroke="currentColor" strokeWidth={1} fill="currentColor" fillOpacity={0.12} />
      <g className="text-white/80" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round">
        <line x1={20} y1={22} x2={44} y2={22} />
        <line x1={22} y1={27} x2={42} y2={27} />
        <line x1={18} y1={32} x2={46} y2={32} />
      </g>
    </SlideFrame>
  );
}

function IconTextProducts() {
  return (
    <SlideFrame>
      <line
        x1={33}
        y1={6}
        x2={33}
        y2={34}
        stroke="currentColor"
        strokeWidth={1}
        className="text-white/35"
        strokeDasharray="2 2"
      />
      <g className="text-white/80" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round">
        <line x1={9} y1={12} x2={26} y2={12} />
        <line x1={9} y1={17} x2={24} y2={17} />
        <line x1={9} y1={22} x2={28} y2={22} />
      </g>
      {[0, 1, 2].flatMap((row) =>
        [0, 1].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={37 + col * 11}
            y={9 + row * 8}
            width={8}
            height={6}
            rx={0.5}
            className="text-white/50"
            stroke="currentColor"
            strokeWidth={1}
            fill="currentColor"
            fillOpacity={0.12}
          />
        )),
      )}
    </SlideFrame>
  );
}

function layoutIsProduct(v: HeroLayoutVisualValue): boolean {
  return v === 'text-products' || v === 'text-products-below' || v === 'products-text-below';
}

export type HeroSimpleLayoutConfig = {
  textZone: 'center' | 'side';
  withPhoto: boolean;
  /** `none` = bez fotky; `beside` = vlevo text + fotka vpravo; `fullscreen` = fotka přes slide + karty. */
  photoPlacement?: 'none' | 'beside' | 'fullscreen';
};

/** Pod barvou textu: pozice textu (střed / bok) a fotka (ne / ano). Fotka jde i se „středem“ — text v centru svého sloupce. */
export function HeroSimpleTextLayoutControls({
  layoutVisual,
  heroImageColumnAlign,
  onLayoutConfig,
  onExitProductLayout,
}: {
  layoutVisual: HeroLayoutVisualValue;
  /** Jen u `left-image`: zarovnání textu v levém sloupci. */
  heroImageColumnAlign: 'start' | 'center';
  onLayoutConfig: (cfg: HeroSimpleLayoutConfig) => void;
  /** Z „slide s produkty“ zpět na jednoduchý text. */
  onExitProductLayout: () => void;
}) {
  const product = layoutIsProduct(layoutVisual);
  const withPhoto = layoutVisual === 'left-image' || layoutVisual === 'full-image';
  const photoBeside = layoutVisual === 'left-image';
  const photoFullscreen = layoutVisual === 'full-image';
  const textZoneCenter =
    layoutVisual === 'center' || (withPhoto && heroImageColumnAlign === 'center');
  const textZoneSide =
    layoutVisual === 'left-text' || (withPhoto && heroImageColumnAlign === 'start');

  const btn = (on: boolean) =>
    on
      ? 'border-[#7C3AED] bg-[#7C3AED]/20 text-white ring-1 ring-[#7C3AED]/45'
      : 'border-white/12 bg-[#0f1117]/80 text-white/70 hover:border-white/25 hover:bg-white/[0.04]';

  if (product) {
    const label =
      layoutVisual === 'text-products'
        ? 'Text vlevo + produkty vpravo'
        : layoutVisual === 'text-products-below'
          ? 'Text uprostřed + produkty pod'
          : 'Produkty nahoře + text pod';
    return (
      <div className="border-t border-white/10 pt-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">Základní text a fotka</p>
        <p className="mt-1 text-[11px] leading-snug text-white/65">
          U rozložení s obálkami se pozice řídí variantou níže. Aktivní: <span className="font-semibold text-white/85">{label}</span>.
        </p>
        <button
          type="button"
          onClick={onExitProductLayout}
          className="mt-2 text-left text-[11px] font-bold text-[#c4b5fd] underline decoration-[#c4b5fd]/40 underline-offset-2 hover:text-white"
        >
          Přepnout na jednoduchý slide (jen text / fotka)
        </button>
      </div>
    );
  }

  const currentTextZone: 'center' | 'side' = textZoneCenter ? 'center' : 'side';

  return (
    <div className="space-y-2.5" role="group" aria-label="Pozice textu a fotka">
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/45">Kde je text</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={textZoneCenter}
            onClick={() =>
              onLayoutConfig({
                textZone: 'center',
                withPhoto,
                photoPlacement: photoBeside ? 'beside' : photoFullscreen ? 'fullscreen' : 'none',
              })
            }
            className={`flex-1 min-w-[7rem] rounded-xl border px-3 py-2 text-center text-[11px] font-bold transition-colors ${btn(textZoneCenter)}`}
          >
            Na střed
          </button>
          <button
            type="button"
            aria-pressed={textZoneSide}
            onClick={() =>
              onLayoutConfig({
                textZone: 'side',
                withPhoto,
                photoPlacement: photoBeside ? 'beside' : photoFullscreen ? 'fullscreen' : 'none',
              })
            }
            className={`flex-1 min-w-[7rem] rounded-xl border px-3 py-2 text-center text-[11px] font-bold transition-colors ${btn(textZoneSide)}`}
          >
            Na bok (vlevo)
          </button>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/45">Fotka</p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={!withPhoto}
              onClick={() => onLayoutConfig({ textZone: currentTextZone, withPhoto: false, photoPlacement: 'none' })}
              className={`min-w-[6.5rem] flex-1 rounded-xl border px-2 py-2 text-center text-[11px] font-bold transition-colors ${btn(!withPhoto)}`}
            >
              Bez fotky
            </button>
            <button
              type="button"
              aria-pressed={photoBeside}
              onClick={() => onLayoutConfig({ textZone: currentTextZone, withPhoto: true, photoPlacement: 'beside' })}
              className={`min-w-[6.5rem] flex-1 rounded-xl border px-2 py-2 text-center text-[11px] font-bold leading-snug transition-colors ${btn(photoBeside)}`}
            >
              Vedle textu
            </button>
            <button
              type="button"
              aria-pressed={photoFullscreen}
              onClick={() =>
                onLayoutConfig({ textZone: currentTextZone, withPhoto: true, photoPlacement: 'fullscreen' })
              }
              className={`min-w-[6.5rem] flex-1 rounded-xl border px-2 py-2 text-center text-[11px] font-bold leading-snug transition-colors ${btn(photoFullscreen)}`}
            >
              Celý slide
            </button>
          </div>
        </div>
        <p className="mt-1 text-[9px] leading-snug text-white/35">
          „Celý slide“ = fotka přes celou plochu; nadpis a texty jsou v zaoblených polích (sklo). U „Vedle textu“ je
          rozložení jako dřív. U fotky platí „Na střed“ / „Na bok“ pro zarovnání sloupce s textem (nebo karet).
        </p>
      </div>
    </div>
  );
}

const PRODUCT_OPTIONS: {
  value: HeroLayoutVisualValue;
  label: string;
  Icon: React.FC;
}[] = [
  { value: 'text-products', label: 'Text vlevo + produkty', Icon: IconTextProducts },
  {
    value: 'text-products-below',
    label: 'Text na střed + produkty pod',
    Icon: IconTextProductsBelow,
  },
  {
    value: 'products-text-below',
    label: 'Produkty nahoře + text pod',
    Icon: IconProductsTextBelow,
  },
];

type ProductPickerProps = {
  value: HeroLayoutVisualValue;
  onChange: (v: HeroLayoutVisualValue) => void;
  className?: string;
};

/** Jen varianty s obálkami (produkty). */
export function HeroProductLayoutPicker({ value, onChange, className = '' }: ProductPickerProps) {
  return (
    <div className={`grid grid-cols-1 gap-2 sm:grid-cols-3 ${className}`} role="group" aria-label="Rozložení slidu s produkty">
      {PRODUCT_OPTIONS.map(({ value: v, label, Icon }) => {
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            title={label}
            aria-pressed={selected}
            className={[
              'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-left transition-colors',
              selected
                ? 'border-[#7C3AED] bg-[#7C3AED]/15 ring-1 ring-[#7C3AED]/50'
                : 'border-white/12 bg-[#0f1117]/80 hover:border-white/25 hover:bg-white/[0.04]',
            ].join(' ')}
          >
            <Icon />
            <span className="w-full text-center text-[10px] font-semibold leading-tight text-white/75">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
