import React from 'react';
import type {
  StudioKidsAgePreset,
  StudioKidsCompositionId,
  StudioKidsFramingId,
  StudioKidsOptions,
  StudioKidsPoseId,
  StudioKidsPrintsId,
} from '../../utils/studioKidsPrompt';

const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/* ── SVG náhledy (48×48, čáry) ── */

function IconFrame({ active, children }: { active: boolean; children: React.ReactNode }) {
  const cls = active ? 'text-[#7C3AED]' : 'text-[#001161]/35';
  return (
    <svg viewBox="0 0 48 48" className={`w-9 h-9 shrink-0 ${cls}`} fill="none" aria-hidden>
      {children}
    </svg>
  );
}

function strokeProps(active: boolean) {
  return {
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

/** Dvě postavy – holka + kluk (vlasy) */
function SvgCompGirlBoy({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <path {...s} d="M14 38v-8M14 22v4M14 22c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5M11 18c0-1.5 1-2.5 2.5-2.5s2 1 2.5 2.5" />
      <path {...s} d="M34 38v-10M34 20v4M34 20c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5M30 16l2-2 2 2" />
      <rect {...s} x="10" y="26" width="8" height="6" rx="1" />
      <rect {...s} x="30" y="24" width="8" height="6" rx="1" />
    </IconFrame>
  );
}

function SvgCompTwoBoys({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <path {...s} d="M12 38v-9M12 21v4M12 21c0-2 1.5-3.5 3.5-3.5M9 17l2-2 2 2M20 38v-9M20 21v4M20 21c0-2 1.5-3.5 3.5-3.5M17 17l2-2 2 2" />
      <rect {...s} x="8" y="25" width="8" height="6" rx="1" />
      <rect {...s} x="16" y="25" width="8" height="6" rx="1" />
    </IconFrame>
  );
}

function SvgCompTwoGirls({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <path {...s} d="M12 38v-8M12 22v4M10 18c2-3 6-3 8 0M20 38v-8M20 22v4M18 18c2-3 6-3 8 0" />
      <rect {...s} x="8" y="26" width="8" height="6" rx="1" />
      <rect {...s} x="16" y="26" width="8" height="6" rx="1" />
    </IconFrame>
  );
}

/** Holka + dva kluci */
function SvgCompGirlTwoBoys({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <path {...s} d="M24 40v-7M24 26v3M22 22c1.5-2.5 5-2.5 6 0M16 38v-6M16 26v2M14 23l1.5-1.5 1.5 1.5M32 38v-6M32 26v2M30 23l1.5-1.5 1.5 1.5" />
      <rect {...s} x="20" y="29" width="8" height="5" rx="1" />
      <rect {...s} x="12" y="28" width="7" height="5" rx="1" />
      <rect {...s} x="29" y="28" width="7" height="5" rx="1" />
    </IconFrame>
  );
}

/** Kluk + dvě holky */
function SvgCompBoyTwoGirls({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <path {...s} d="M24 40v-7M24 26v3M22 23l2-2 2 2M14 38v-6M14 26v2M12 22c2-2.5 5-2.5 7 0M34 38v-6M34 26v2M32 22c2-2.5 5-2.5 7 0" />
      <rect {...s} x="20" y="29" width="8" height="5" rx="1" />
      <rect {...s} x="10" y="28" width="7" height="5" rx="1" />
      <rect {...s} x="31" y="28" width="7" height="5" rx="1" />
    </IconFrame>
  );
}

function SvgCompThreeMixed({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <path {...s} d="M10 38v-6M10 27v2M8 24c1-2 4-2 5 0M24 40v-8M24 24v4M22 20c2-2 6-2 8 0M38 38v-6M38 27v2M36 23l2-2 2 2" />
      <rect {...s} x="6" y="29" width="8" height="5" rx="1" />
      <rect {...s} x="20" y="28" width="8" height="6" rx="1" />
      <rect {...s} x="34" y="29" width="8" height="5" rx="1" />
    </IconFrame>
  );
}

function SvgPoseFloor({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <line {...s} x1="4" y1="40" x2="44" y2="40" />
      <path {...s} d="M18 40v-12M18 24c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5M14 20c0-1.5 1-2.5 2.5-2.5M22 28l-4 8M26 28l4 8" />
      <path {...s} d="M30 40v-12M30 24c0-2.5 2-4.5 4.5-4.5M34 28l-3 7M28 28l-2 6" />
    </IconFrame>
  );
}

function SvgPoseDesk({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <rect {...s} x="6" y="30" width="36" height="4" rx="1" />
      <path {...s} d="M16 30v-8M16 18c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5M32 30v-8M32 18c0-2 1.5-3.5 3.5-3.5" />
      <line {...s} x1="10" y1="34" x2="10" y2="40" />
      <line {...s} x1="38" y1="34" x2="38" y2="40" />
    </IconFrame>
  );
}

function SvgPoseStand({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <line {...s} x1="4" y1="42" x2="44" y2="42" />
      <path {...s} d="M18 42v-22M18 16c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5M14 38l4-16M22 38l-4-16" />
      <path {...s} d="M32 42v-20M32 18c0-2 2-4 4-4M28 38l4-14M36 38l-4-14" />
    </IconFrame>
  );
}

function SvgFrameFull({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <rect {...s} x="14" y="8" width="20" height="32" rx="2" strokeDasharray="3 2" />
      <path {...s} d="M24 14c-2 0-3.5 1.5-3.5 3.5M24 40v-4" />
      <path {...s} d="M20 22h8M22 26h4" />
    </IconFrame>
  );
}

function SvgFrameWaist({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <rect {...s} x="12" y="10" width="24" height="22" rx="2" strokeDasharray="3 2" />
      <path {...s} d="M24 16c-2 0-3.5 1.5-3.5 3.5M18 24h12" />
      <path {...s} d="M16 38h16" opacity={0.45} />
      <path {...s} d="M14 36c2.5 1 6.5 1 9 0s6.5-1 9 0" opacity={0.35} />
    </IconFrame>
  );
}

function SvgPrintsHands({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <path {...s} d="M24 20c-2 0-4 1.5-4 3.5V34M24 20c2 0 4 1.5 4 3.5V34" />
      <rect {...s} x="14" y="22" width="7" height="9" rx="1" />
      <rect {...s} x="27" y="22" width="7" height="9" rx="1" />
      <path {...s} d="M17 31l3 5M31 31l-3 5" />
    </IconFrame>
  );
}

function SvgPrintsScatter({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <line {...s} x1="6" y1="38" x2="42" y2="38" />
      <rect {...s} x="8" y="30" width="8" height="6" rx="1" transform="rotate(-12 12 33)" />
      <rect {...s} x="22" y="24" width="8" height="6" rx="1" transform="rotate(8 26 27)" />
      <rect {...s} x="32" y="31" width="8" height="6" rx="1" transform="rotate(-6 36 34)" />
      <path {...s} d="M24 20v10M20 18h8" />
    </IconFrame>
  );
}

function SvgPrintsTable({ active }: { active: boolean }) {
  const s = strokeProps(active);
  return (
    <IconFrame active={active}>
      <rect {...s} x="6" y="28" width="36" height="5" rx="1" />
      <rect {...s} x="12" y="22" width="10" height="7" rx="1" />
      <rect {...s} x="26" y="23" width="10" height="7" rx="1" />
      <path {...s} d="M24 14c-1.5 0-3 1-3 2.5V20" />
    </IconFrame>
  );
}

const COMPOSITION_OPTS: {
  id: StudioKidsCompositionId;
  label: string;
  Icon: React.FC<{ active: boolean }>;
}[] = [
  { id: 'girl_boy', label: 'Holka + kluk', Icon: SvgCompGirlBoy },
  { id: 'two_boys', label: 'Dva kluci', Icon: SvgCompTwoBoys },
  { id: 'two_girls', label: 'Dvě holky', Icon: SvgCompTwoGirls },
  { id: 'girl_two_boys', label: 'Holka + 2 kluci', Icon: SvgCompGirlTwoBoys },
  { id: 'boy_two_girls', label: 'Kluk + 2 holky', Icon: SvgCompBoyTwoGirls },
  { id: 'three_mixed', label: '3 děti (mix)', Icon: SvgCompThreeMixed },
];

const POSE_OPTS: { id: StudioKidsPoseId; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'floor_crosslegged', label: 'Na zemi', Icon: SvgPoseFloor },
  { id: 'desk_sitting', label: 'U stolu', Icon: SvgPoseDesk },
  { id: 'standing', label: 'Stojí', Icon: SvgPoseStand },
];

const FRAMING_OPTS: { id: StudioKidsFramingId; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'full_body', label: 'Celá postava', Icon: SvgFrameFull },
  { id: 'waist_up', label: 'Půl těla', Icon: SvgFrameWaist },
];

const PRINTS_OPTS: { id: StudioKidsPrintsId; label: string; hint?: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'in_hands', label: 'V rukou', Icon: SvgPrintsHands },
  { id: 'scattered_around', label: 'Kolem nich', Icon: SvgPrintsScatter },
  { id: 'on_surface_front', label: 'Před nimi (stůl/podlaha)', hint: 'U stolu na desce, jinak před nimi na zemi', Icon: SvgPrintsTable },
];

const AGE_OPTS: { id: StudioKidsAgePreset; label: string }[] = [
  { id: '4_6', label: '4–6 let' },
  { id: '7_9', label: '7–9 let' },
  { id: '10_12', label: '10–12 let' },
  { id: '13_15', label: '13–15 let' },
  { id: 'custom', label: 'Vlastní rozmezí' },
];

function OptionButton<T extends string>({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-center transition-all cursor-pointer min-h-[4.5rem] justify-center ${
        active
          ? 'border-[#7C3AED] bg-[#7C3AED]/8 text-[#7C3AED]'
          : 'border-gray-100 bg-white text-[#001161]/40 hover:border-gray-200'
      }`}
      style={F}
    >
      {children}
    </button>
  );
}

export interface StudioKidsStylePanelProps {
  value: StudioKidsOptions;
  onChange: (next: StudioKidsOptions) => void;
  onCopyReferencePrompt?: () => void;
}

export function StudioKidsStylePanel({ value, onChange, onCopyReferencePrompt }: StudioKidsStylePanelProps) {
  const patch = (p: Partial<StudioKidsOptions>) => onChange({ ...value, ...p });

  return (
    <div className="rounded-xl border border-violet-100 bg-gradient-to-b from-violet-50/50 to-white p-3 space-y-3">
      <div>
        <p style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider">
          Děti ve studiu — parametry
        </p>
        <p style={F} className="text-[10px] text-[#001161]/45 leading-snug mt-0.5">
          Tyto volby platí pro <strong className="text-[#001161]/55">aktuálně vybraný styl</strong> v dropdownu výše (typ šablony nastavíte v{' '}
          <strong className="text-[#7C3AED]">Referenční styly</strong>). Ukládají se k tomuto stylu v tomto prohlížeči.
        </p>
      </div>

      {onCopyReferencePrompt && (
        <button
          type="button"
          onClick={onCopyReferencePrompt}
          className="text-[9px] font-bold text-[#7C3AED] hover:underline cursor-pointer"
          style={F}
        >
          Zkopírovat výchozí prompt pro nový styl (Nastavení)…
        </button>
      )}

      <div>
            <p style={F} className="text-[9px] font-bold text-[#001161]/30 uppercase tracking-wider mb-1.5">
              Složení dětí
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {COMPOSITION_OPTS.map(({ id, label, Icon }) => (
                <OptionButton key={id} active={value.composition === id} onClick={() => patch({ composition: id })}>
                  <Icon active={value.composition === id} />
                  <span className="text-[9px] font-bold leading-tight px-0.5">{label}</span>
                </OptionButton>
              ))}
            </div>
          </div>

          <div>
            <p style={F} className="text-[9px] font-bold text-[#001161]/30 uppercase tracking-wider mb-1.5">
              Póza / prostředí
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {POSE_OPTS.map(({ id, label, Icon }) => (
                <OptionButton key={id} active={value.pose === id} onClick={() => patch({ pose: id })}>
                  <Icon active={value.pose === id} />
                  <span className="text-[9px] font-bold">{label}</span>
                </OptionButton>
              ))}
            </div>
          </div>

          <div>
            <p style={F} className="text-[9px] font-bold text-[#001161]/30 uppercase tracking-wider mb-1.5">
              Záběr
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {FRAMING_OPTS.map(({ id, label, Icon }) => (
                <OptionButton key={id} active={value.framing === id} onClick={() => patch({ framing: id })}>
                  <Icon active={value.framing === id} />
                  <span className="text-[9px] font-bold">{label}</span>
                </OptionButton>
              ))}
            </div>
          </div>

          <div>
            <p style={F} className="text-[9px] font-bold text-[#001161]/30 uppercase tracking-wider mb-1.5">
              Tiskoviny / sešity
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {PRINTS_OPTS.map(({ id, label, hint, Icon }) => (
                <OptionButton key={id} active={value.prints === id} onClick={() => patch({ prints: id })}>
                  <div className="flex items-center gap-2 w-full px-1">
                    <Icon active={value.prints === id} />
                    <div className="text-left min-w-0">
                      <span className="text-[10px] font-bold block">{label}</span>
                      {hint && (
                        <span className="text-[8px] font-medium text-[#001161]/35 block leading-tight">{hint}</span>
                      )}
                    </div>
                  </div>
                </OptionButton>
              ))}
            </div>
          </div>

          <div>
            <p style={F} className="text-[9px] font-bold text-[#001161]/30 uppercase tracking-wider mb-1.5">
              Věk dětí
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AGE_OPTS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch({ agePreset: id })}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                    value.agePreset === id
                      ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#7C3AED]'
                      : 'border-gray-100 bg-gray-50 text-[#001161]/40 hover:border-gray-200'
                  }`}
                  style={F}
                >
                  {label}
                </button>
              ))}
            </div>
            {value.agePreset === 'custom' && (
              <div className="flex items-center gap-2 mt-2">
                <label style={F} className="text-[10px] text-[#001161]/50 shrink-0">
                  Od
                </label>
                <input
                  type="number"
                  min={3}
                  max={17}
                  value={value.ageMin}
                  onChange={(e) => patch({ ageMin: Number(e.target.value) })}
                  className="w-14 text-[12px] border border-gray-200 rounded-lg px-2 py-1"
                />
                <label style={F} className="text-[10px] text-[#001161]/50 shrink-0">
                  do
                </label>
                <input
                  type="number"
                  min={3}
                  max={17}
                  value={value.ageMax}
                  onChange={(e) => patch({ ageMax: Number(e.target.value) })}
                  className="w-14 text-[12px] border border-gray-200 rounded-lg px-2 py-1"
                />
                <span style={F} className="text-[9px] text-[#001161]/30">
                  let
                </span>
              </div>
            )}
          </div>
    </div>
  );
}
