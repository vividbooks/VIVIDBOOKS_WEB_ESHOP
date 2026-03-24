// Vividbooks phone SVG frame — green style
export function PhoneSvg({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="286" height="468" viewBox="0 0 286 468" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <g filter="url(#filter0_f_phone)">
        <rect x="40.1914" y="40.1875" width="204.881" height="387.507" rx="43.2456" fill="#10966F" fillOpacity="0.6" style={{ mixBlendMode: 'darken' }}/>
      </g>
      <g filter="url(#filter1_f_phone)">
        <rect x="61.8125" y="32.4219" width="170.839" height="368.531" rx="21.0509" fill="#4D8C7A"/>
      </g>
      <rect x="59.7692" y="7.4176" width="200.665" height="405.997" rx="32.1207" fill="#19C795" stroke="#25A580" strokeWidth="2.42895"/>
      <rect x="69.5742" y="16.0781" width="181.006" height="387.876" rx="21.6228" fill="white"/>
      <defs>
        <filter id="filter0_f_phone" x="0.00108719" y="-0.00281906" width="285.263" height="467.888" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur stdDeviation="20.0952" result="effect1_foregroundBlur_phone"/>
        </filter>
        <filter id="filter1_f_phone" x="43.4043" y="14.0137" width="207.656" height="405.348" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur stdDeviation="9.20409" result="effect1_foregroundBlur1_phone"/>
        </filter>
      </defs>
    </svg>
  );
}
