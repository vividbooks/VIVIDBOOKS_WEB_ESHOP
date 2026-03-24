import React, { useState } from 'react';
import { Package } from 'lucide-react';

/** Stejné vrstvené stíny jako tiskoviny v UnifiedBookCard — sdílené i upsell dlaždicemi */
export const BOOK_COVER_DROP_SHADOW = [
  'drop-shadow(2px 4px 3px rgba(0,17,97,0.22))',
  'drop-shadow(5px 14px 18px rgba(0,17,97,0.22))',
  'drop-shadow(8px 32px 25px rgba(0,17,97,0.12))',
].join(' ');

export function BookCoverThumb({
  imageUrl,
  alt,
  size = 'md',
}: {
  imageUrl?: string;
  alt: string;
  /** sm = řádek v draweru, md = řádek na pokladně */
  size?: 'sm' | 'md';
}) {
  const [isLandscape, setIsLandscape] = useState(false);
  const outerW = size === 'sm' ? 'w-[64px]' : 'w-[92px]';
  const maxH = size === 'sm' ? 'max-h-[88px]' : 'max-h-[118px]';
  const placeholderH = size === 'sm' ? 'h-[88px]' : 'h-[118px]';

  return (
    <div className={`${outerW} shrink-0 flex justify-center items-start`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className={`${maxH} w-auto ${isLandscape ? 'max-w-[90%]' : 'max-w-[78%]'} object-contain`}
          style={{ filter: BOOK_COVER_DROP_SHADOW }}
          onLoad={(e) => {
            const img = e.currentTarget;
            setIsLandscape(img.naturalWidth >= img.naturalHeight);
          }}
        />
      ) : (
        <div
          className={`${placeholderH} w-full flex items-center justify-center bg-[#f1f3f8]`}
        >
          <Package className="w-5 h-5 text-[#001161]/20" />
        </div>
      )}
    </div>
  );
}
