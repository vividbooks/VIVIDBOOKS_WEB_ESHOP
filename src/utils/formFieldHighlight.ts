/**
 * Zvýrazní nevalidní blok: scroll na střed, červený rámeček, krátké zatřepání.
 * Třídy jsou v globals.css (.vb-form-field-error, .vb-form-field-shake).
 */
export function flashInvalidField(el: HTMLElement | null): void {
  if (!el || typeof window === 'undefined') return;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const run = () => {
    el.classList.add('vb-form-field-error', 'vb-form-field-shake');
    const onEnd = () => {
      el.classList.remove('vb-form-field-shake');
      el.removeEventListener('animationend', onEnd);
    };
    el.addEventListener('animationend', onEnd, { once: true });
    window.setTimeout(() => {
      el.classList.remove('vb-form-field-error');
    }, 2800);
  };

  // Po přerenderu (např. po setState) + scroll start
  window.setTimeout(run, 50);
}
