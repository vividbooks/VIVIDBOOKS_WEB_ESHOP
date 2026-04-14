/**
 * Rozdělí Tailwind třídy z <img> na wrapper / náhled / plné rozlišení (progresivní načítání).
 */
export function splitImageClassName(className: string | undefined): {
  wrapper: string;
  thumb: string;
  full: string;
} {
  const raw = (className || '').trim().split(/\s+/).filter(Boolean);
  if (raw.length === 0) {
    return {
      wrapper: 'relative isolate inline-block max-w-full',
      thumb:
        'pointer-events-none absolute inset-0 z-0 h-full w-full object-contain object-bottom scale-110 blur-lg transition-opacity duration-500',
      full:
        'absolute inset-0 z-[1] h-full w-full object-contain object-bottom transition-opacity duration-500 ease-out',
    };
  }

  const objectTokens = raw.filter((t) => t.startsWith('object-'));
  const interactiveTokens = raw.filter(
    (t) =>
      t.startsWith('group-hover:')
      || t.startsWith('hover:')
      || t.startsWith('focus-visible:')
      || t.startsWith('transition')
      || t.startsWith('duration-')
      || t.startsWith('ease-')
      || t.startsWith('origin-')
      || t.startsWith('will-change-')
      || t.startsWith('motion-safe:'),
  );
  const effectTokens = raw.filter(
    (t) =>
      t.includes('shadow')
      || t.includes('drop-shadow')
      || (t.startsWith('blur-') && !t.startsWith('blur-sm')),
  );
  const layoutTokens = raw.filter(
    (t) =>
      !objectTokens.includes(t)
      && !interactiveTokens.includes(t)
      && !effectTokens.includes(t),
  );

  const objectPart = objectTokens.length ? objectTokens.join(' ') : 'object-contain object-bottom';

  const wrapper = [...layoutTokens, 'relative', 'isolate'].join(' ').replace(/\s+/g, ' ').trim();

  const thumb = [
    'pointer-events-none',
    'absolute',
    'inset-0',
    'z-0',
    'h-full',
    'w-full',
    objectPart,
    'scale-110',
    'blur-lg',
    'transition-opacity',
    'duration-500',
  ].join(' ');

  /** Jinak Tailwind přepne `transition-property` jen na opacity a group-hover transformy „skočí“. */
  const hasTransitionUtility = interactiveTokens.some((t) => t.startsWith('transition'));

  const full = [
    'absolute',
    'inset-0',
    'z-[1]',
    'h-full',
    'w-full',
    objectPart,
    ...interactiveTokens,
    ...effectTokens,
    ...(hasTransitionUtility
      ? []
      : ['transition-opacity', 'duration-500', 'ease-out']),
  ].join(' ');

  return { wrapper, thumb, full };
}
