import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

export const VIVIDBOOKS_TEXT_COLORS = [
  '#006AF0',
  '#00805B',
  '#00DC69',
  '#03036A',
  '#092EFF',
  '#1D1D1B',
  '#40A2FF',
  '#5139ED',
  '#893550',
  '#FF184A',
  '#FF794B',
  '#001161',
  '#FFFFFF',
] as const;

export function mixPastelSolidHex(hex: string, opacityPercent: number): string {
  const a = Math.max(0, Math.min(1, opacityPercent / 100));
  const raw = hex.slice(1);
  const mix = (channel: number) => Math.round(255 * (1 - a) + channel * a);
  const r = mix(Number.parseInt(raw.slice(0, 2), 16));
  const g = mix(Number.parseInt(raw.slice(2, 4), 16));
  const b = mix(Number.parseInt(raw.slice(4, 6), 16));
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function VividbooksColorButton({
  title,
  buttonClassName,
  children,
  onSelect,
  palette = 'brand',
}: {
  title: string;
  buttonClassName: string;
  children: React.ReactNode;
  onSelect: (color: string) => void;
  /** brand = plné barvy; pastel = rgba do 20 %; pastelSolid = pastel smíchaný s bílou (hex) */
  palette?: 'brand' | 'pastel' | 'pastelSolid';
}) {
  const [open, setOpen] = useState(false);
  const [pastelOpacity, setPastelOpacity] = useState(12);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const isPastel = palette === 'pastel' || palette === 'pastelSolid';

  const positionPopup = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 240;
    const height = isPastel ? 310 : 200;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top =
      rect.bottom + 8 + height <= window.innerHeight
        ? rect.bottom + 8
        : Math.max(8, rect.top - height - 8);
    setPopupPosition({ top, left });
  }, [isPastel]);

  const paletteColor = (hex: string) => {
    if (palette === 'brand') return hex;
    if (palette === 'pastelSolid') return mixPastelSolidHex(hex, pastelOpacity);
    const raw = hex.slice(1);
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${pastelOpacity / 100})`;
  };

  const openPopup = useCallback(() => {
    positionPopup();
    setOpen(true);
  }, [positionPopup]);

  useEffect(() => {
    if (!open) return;
    positionPopup();
    const closeOutside = (event: MouseEvent) => {
      const node = event.target as Node;
      if (buttonRef.current?.contains(node) || popupRef.current?.contains(node)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', positionPopup);
    window.addEventListener('scroll', positionPopup, true);
    // click (ne mousedown): ať se nestihne zavřít ve stejném gesture jako otevření
    document.addEventListener('click', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', positionPopup);
      window.removeEventListener('scroll', positionPopup, true);
      document.removeEventListener('click', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, positionPopup]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        title={title}
        aria-label={title}
        aria-expanded={open}
        aria-haspopup="dialog"
        onMouseDown={event => {
          // Toolbar jinak preventDefaultuje mousedown — toggle tady, ať se výběr v iframu nekazí
          event.preventDefault();
          event.stopPropagation();
          if (open) setOpen(false);
          else openPopup();
        }}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[100000] w-[240px] rounded-xl border border-gray-200 bg-white p-3 shadow-[0_16px_50px_rgba(15,23,42,0.22)]"
            style={{ ...F, top: popupPosition.top, left: popupPosition.left }}
            role="dialog"
            aria-label={title}
            onMouseDown={event => {
              event.stopPropagation();
            }}
          >
            <div className="mb-2.5 text-[12px] font-semibold text-[#001161]">
              {isPastel ? 'Pastelové Vividbooks barvy' : 'Vividbooks barvy'}
            </div>
            {isPastel && (
              <div className="mb-3 space-y-1.5 rounded-lg bg-gray-50 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-[#001161]/55">Průhlednost</span>
                  <span className="text-[10px] tabular-nums text-[#001161]/40">
                    {Math.max(0, 100 - pastelOpacity)} %
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {/* hodnota = krytí (opacity); 100 % = 0 % průhlednosti */}
                  {([
                    [100, '0 %'],
                    [20, '80 %'],
                    [12, '88 %'],
                    [8, '92 %'],
                  ] as const).map(([opacity, label]) => (
                    <button
                      key={opacity}
                      type="button"
                      title={`Průhlednost ${label}`}
                      className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                        pastelOpacity === opacity
                          ? 'bg-[#5139ED] text-white'
                          : 'bg-white text-[#001161]/55 hover:bg-[#5139ED]/10'
                      }`}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => setPastelOpacity(opacity)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-5 gap-1.5">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:border-[#5139ED]/50 hover:bg-[#5139ED]/5 focus:outline-none focus:ring-2 focus:ring-[#5139ED]/30"
                title="Zrušit barvu / podbarvení"
                aria-label="Zrušit barvu / podbarvení"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  onSelect('transparent');
                  setOpen(false);
                }}
              >
                <span
                  className="relative h-7 w-7 overflow-hidden rounded-full border border-gray-300 bg-white"
                  aria-hidden
                >
                  <span className="absolute inset-[-2px] block rotate-45 border-t border-red-500" />
                </span>
              </button>
              {VIVIDBOOKS_TEXT_COLORS.map(hex => {
                const color = paletteColor(hex);
                return (
                  <button
                    key={hex}
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:border-[#5139ED]/50 hover:bg-[#5139ED]/5 focus:outline-none focus:ring-2 focus:ring-[#5139ED]/30"
                    title={isPastel ? `${hex} · ${pastelOpacity} %` : hex}
                    aria-label={`Použít barvu ${hex}`}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => {
                      onSelect(color);
                      setOpen(false);
                    }}
                  >
                    <span
                      className={`h-7 w-7 rounded-full border shadow-sm ${
                        hex === '#FFFFFF' ? 'border-gray-300' : 'border-black/10'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function EmailPreviewBgColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (color: string) => void;
}) {
  const current = value || fallback;
  return (
    <div>
      <label style={F} className="mb-1 block text-[9px] font-bold uppercase text-[#001161]/40">
        {label}
      </label>
      <VividbooksColorButton
        title={label}
        palette="pastelSolid"
        onSelect={color => onChange(color === 'transparent' ? fallback : color)}
        buttonClassName="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-left text-[11px] font-medium text-[#001161]/65 hover:border-[#5139ED]/35 hover:bg-gray-50"
      >
        <span
          className="h-5 w-5 shrink-0 rounded-md border border-black/10 shadow-sm"
          style={{ backgroundColor: current }}
        />
        <span className="min-w-0 truncate">Vybrat barvu</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#001161]/35" />
      </VividbooksColorButton>
    </div>
  );
}
