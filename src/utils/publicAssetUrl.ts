/**
 * URL for files in `public/` (e.g. `<img src={publicAssetUrl('checkout/foo.svg')} />`).
 * Uses Vite `import.meta.env.BASE_URL` so assets work on GitHub Pages with a subdirectory base.
 */
export function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const trimmed = path.replace(/^\/+/, '');
  return `${normalizedBase}${trimmed}`;
}
