import React, { useMemo, useState } from 'react';
import { supabasePublicUrlToTinyRenderUrl, normalizeSupabaseImageSrc } from '../../utils/supabaseImageThumbnail';
import { splitImageClassName } from './splitImageClassName';
import { isProgressiveStackLayout } from './progressiveStackEligible';

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==';

export type ImageWithFallbackProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** Vypne dvouvrstvé načítání (náhled + plný obrázek). */
  disableProgressive?: boolean;
  /** LCP / above-the-fold — eager + fetchPriority high. */
  priority?: boolean;
};

export function ImageWithFallback({
  disableProgressive,
  priority,
  src,
  alt,
  style,
  className,
  onLoad,
  onError,
  ...rest
}: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false);
  const [fullReady, setFullReady] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const resolvedSrc = useMemo(() => {
    if (!src || typeof src !== 'string') return src;
    return normalizeSupabaseImageSrc(src);
  }, [src]);

  const thumbSrc = useMemo(() => {
    if (disableProgressive || !resolvedSrc || typeof resolvedSrc !== 'string') return null;
    return supabasePublicUrlToTinyRenderUrl(resolvedSrc, { width: 80, quality: 45 });
  }, [resolvedSrc, disableProgressive]);

  const stackOk = isProgressiveStackLayout(className);

  const { wrapper: wrapperClass, thumb: thumbClass, full: fullClass } = useMemo(
    () => splitImageClassName(className),
    [className],
  );

  const handleFullLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setFullReady(true);
    onLoad?.(e);
  };

  const handleError = () => {
    setDidError(true);
  };

  if (didError) {
    return (
      <div
        className={`inline-block bg-gray-100 text-center align-middle ${className ?? ''}`}
        style={style}
      >
        <div className="flex items-center justify-center w-full h-full">
          <img src={ERROR_IMG_SRC} alt="Error loading image" {...rest} data-original-url={src} />
        </div>
      </div>
    );
  }

  const loadMode = priority ? 'eager' : 'lazy';
  const fetchPriority = priority ? 'high' : undefined;

  if (thumbSrc && !thumbFailed && stackOk) {
    const fullStyle: React.CSSProperties = {
      ...(style && typeof style === 'object' ? style : {}),
      opacity: fullReady ? 1 : 0,
    };
    return (
      <span className={wrapperClass}>
        <img
          src={thumbSrc}
          alt=""
          aria-hidden
          className={thumbClass}
          style={{ opacity: fullReady ? 0 : 1 }}
          loading={loadMode}
          decoding="async"
          onError={() => setThumbFailed(true)}
        />
        <img
          src={resolvedSrc}
          alt={alt}
          className={fullClass}
          style={fullStyle}
          loading={loadMode}
          decoding="async"
          fetchPriority={fetchPriority}
          onLoad={handleFullLoad}
          onError={handleError}
          {...rest}
        />
      </span>
    );
  }

  return (
    <img
      src={typeof resolvedSrc === 'string' ? resolvedSrc : src}
      alt={alt}
      className={className}
      style={style}
      loading={loadMode}
      decoding="async"
      fetchPriority={fetchPriority}
      onLoad={onLoad}
      onError={handleError}
      {...rest}
    />
  );
}
