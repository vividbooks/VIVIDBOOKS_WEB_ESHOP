import svgPaths from "./svg-xp4vc97wtj";

function VividbooksLogo() {
  return (
    <div className="absolute inset-[0_0_33.29%_0]" data-name="VIVIDBOOKS LOGO">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1786.62 869.93">
        <g id="VIVIDBOOKS LOGO">
          <path d={svgPaths.p299c6b00} fill="var(--fill-0, #0B3036)" id="Vector" />
          <path d={svgPaths.p3cc4870} fill="var(--fill-0, #0B3036)" id="Vector_2" />
          <path d={svgPaths.p98d9300} fill="var(--fill-0, #0B3036)" id="Vector_3" />
          <path d={svgPaths.pf524b00} fill="var(--fill-0, #0B3036)" id="Vector_4" />
          <path d={svgPaths.p26e2d80} fill="var(--fill-0, #0B3036)" id="Vector_5" />
          <path d={svgPaths.p15998cf0} fill="var(--fill-0, #0B3036)" id="Vector_6" />
          <path d={svgPaths.p1bd3b900} fill="var(--fill-0, #0B3036)" id="Vector_7" />
          <path d={svgPaths.p19a24c00} fill="var(--fill-0, #0B3036)" id="Vector_8" />
          <path d={svgPaths.p34d64300} fill="var(--fill-0, #0B3036)" id="Vector_9" />
          <path d={svgPaths.p396dedf0} fill="var(--fill-0, #0B3036)" id="Vector_10" />
        </g>
      </svg>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents inset-[0_0_33.29%_0]">
      <VividbooksLogo />
    </div>
  );
}

function Group2() {
  return (
    <div className="absolute contents inset-[0_0_33.29%_0]">
      <Group />
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute contents left-[534.86px] top-[1019.13px]">
      <p className="absolute font-['Fenomen_Sans:Regular',sans-serif] leading-[normal] left-[809.69px] not-italic text-[#0b3036] text-[237.529px] top-[1019.13px]">GRADA</p>
      <div className="absolute inset-[79.3%_56.61%_2.62%_29.94%]" data-name="Vector">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 240.382 235.82">
          <path d={svgPaths.p2e17f300} fill="var(--fill-0, #0B3036)" id="Vector" />
        </svg>
      </div>
    </div>
  );
}

function Group3() {
  return (
    <div className="absolute contents left-[188.19px] top-[1019.13px]">
      <p className="absolute font-['Fenomen_Sans:Regular',sans-serif] leading-[normal] left-[188.19px] not-italic text-[#0b3036] text-[237.529px] top-[1019.13px]">BY:</p>
      <Group1 />
    </div>
  );
}

export default function Group4() {
  return (
    <div className="relative size-full">
      <Group2 />
      <Group3 />
    </div>
  );
}