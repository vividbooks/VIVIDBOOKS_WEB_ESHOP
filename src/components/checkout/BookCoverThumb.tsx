import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { PRINT_BOOK_COVER_DROP_SHADOW } from '../../utils/printBookCoverShadow';

/** Stejný stín jako tiskoviny v katalogu / PDP (Figma spec). */
export const BOOK_COVER_DROP_SHADOW = PRINT_BOOK_COVER_DROP_SHADOW;

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
