import React from 'react';

interface WebinarThumbnailProps {
  title: string;
  subtitle?: string;
  day: number;
  monthName: string;
  time: string;
  lecturer: string;
  lecturerAvatar?: string;
  variant: 1 | 2 | 3;
  /** Webflow cover image URL — pokud je k dispozici, zobrazí se místo SVG shapes */
  coverImage?: string;
}

// Decorative shapes for each variant
function Shapes1() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <circle cx="160" cy="40" r="60" fill="white" opacity="0.15" />
      <circle cx="120" cy="160" r="50" fill="white" opacity="0.12" />
      <ellipse cx="130" cy="100" rx="38" ry="38" fill="#F472B6" opacity="0.9" />
      <ellipse cx="130" cy="72" rx="22" ry="22" fill="#F9A8D4" opacity="0.85" />
      <ellipse cx="130" cy="128" rx="22" ry="22" fill="#F9A8D4" opacity="0.85" />
      <ellipse cx="102" cy="100" rx="22" ry="22" fill="#F9A8D4" opacity="0.85" />
      <ellipse cx="158" cy="100" rx="22" ry="22" fill="#F9A8D4" opacity="0.85" />
      <circle cx="130" cy="100" r="25" fill="#EC4899" opacity="0.95" />
      <circle cx="175" cy="165" r="55" fill="white" opacity="0.15" />
      <circle cx="30" cy="30" r="30" fill="white" opacity="0.08" />
    </svg>
  );
}

function Shapes2() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect x="70" y="30" width="110" height="32" rx="4" fill="#9B59B6" />
      <rect x="70" y="68" width="110" height="32" rx="4" fill="#E74C3C" />
      <rect x="70" y="106" width="110" height="32" rx="4" fill="#E8E8E8" />
      <rect x="70" y="144" width="110" height="32" rx="4" fill="#2ECC71" />
      <circle cx="30" cy="50" r="20" fill="white" opacity="0.1" />
      <circle cx="20" cy="140" r="30" fill="white" opacity="0.08" />
    </svg>
  );
}

function Shapes3() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <circle cx="145" cy="100" r="60" fill="#2ECC71" opacity="0.95" />
      <path d="M85 100 A60 60 0 0 1 145 40 L145 100 Z" fill="#27AE60" opacity="0.9" />
      <rect x="105" y="60" width="50" height="50" rx="4" fill="#E74C3C" opacity="0.9" />
      <rect x="120" y="115" width="35" height="35" rx="4" fill="white" opacity="0.9" />
      <circle cx="90" cy="150" r="20" fill="#3498DB" opacity="0.9" />
      <circle cx="165" cy="55" r="10" fill="#3498DB" opacity="0.85" />
    </svg>
  );
}

const SHAPES = { 1: Shapes1, 2: Shapes2, 3: Shapes3 };

export function WebinarThumbnail({
  title,
  subtitle,
  day,
  monthName,
  time,
  lecturer,
  lecturerAvatar,
  variant,
  coverImage,
}: WebinarThumbnailProps) {
  const ShapesComponent = SHAPES[variant] || Shapes1;

  // Pokud je coverImage — zobraz jen obrázek, plná šířka, bez žlutého panelu
  if (coverImage) {
    return (
      <div className="relative w-full overflow-hidden rounded-t-[16px]" style={{ background: '#001158', aspectRatio: '16/9' }}>
        <img
          src={coverImage}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Fallback — původní design se žlutým panelem a SVG shapes
  return (
    <div className="relative w-full overflow-hidden rounded-t-[16px]" style={{ background: '#001158', aspectRatio: '16/9' }}>
      {/* Left yellow panel */}
      <div
        className="absolute left-0 top-0 bottom-0 flex flex-col justify-between p-4"
        style={{
          width: '58%',
          background: '#F5D645',
          borderRadius: '0 20px 20px 0',
          zIndex: 2,
        }}
      >
        <div>
          {subtitle && (
            <p className="font-['Fenomen_Sans',sans-serif] text-[#001158] text-[11px] mb-1.5 leading-tight opacity-75">
              {subtitle}
            </p>
          )}
          <h3
            className="font-['Fenomen_Sans',sans-serif] font-black text-[#001158] leading-[1.1]"
            style={{ fontSize: 'clamp(11px, 2.5vw, 17px)' }}
          >
            {title}
          </h3>
        </div>
        <div>
          <p className="font-['Fenomen_Sans',sans-serif] font-bold text-[#001158] text-[10px] leading-tight">
            {'DVPP Webin\u00e1\u0159 zdarma'}
          </p>
          <p className="font-['Fenomen_Sans',sans-serif] font-bold text-[#001158] text-[10px] leading-tight">
            {`${day}. ${monthName.slice(0, 3).toLowerCase()}. ${new Date().getFullYear()} od ${time}`}
          </p>
          {lecturer && (
            <p className="font-['Fenomen_Sans',sans-serif] font-bold text-[#001158] text-[10px] leading-tight mb-1 truncate max-w-[160px]">
              {lecturer}
            </p>
          )}
          {/* Avatar — pro Webflow data je to cover image nebo prázdné */}
          {lecturerAvatar && (
            <img
              src={lecturerAvatar}
              alt={lecturer}
              className="w-8 h-8 rounded-full object-cover border-2 border-[#001158]/20"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>
      </div>

      {/* Right side — coverImage nebo SVG shapes */}
      <div className="absolute right-0 top-0 bottom-0" style={{ width: '48%', zIndex: 1 }}>
        {coverImage ? (
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback na shapes při chybě obrázku
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) parent.style.background = '#1a1a4e';
            }}
          />
        ) : (
          <ShapesComponent />
        )}
      </div>
    </div>
  );
}