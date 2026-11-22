/**
 * Které zápisy obsahu webu vyžadují admin JWT nebo token asistenta (viz middleware v index.tsx).
 * GET zůstává veřejný (čte ho web i e-shop).
 */
const PROTECTED_WRITE_PREFIXES = [
  '/admin/webinare',
  '/admin/blog',
  '/admin/novinky',
  '/admin/hero-slidy',
  '/admin/fixed-pages',
  '/admin/predmety',
  '/admin/tabs',
  '/admin/notifikace',
  '/admin/product-bundles',
  '/admin/seed',
  '/products',
  '/images',
  '/clear-products',
];
const PROTECTED_WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isProtectedContentWrite(method: string, pathname: string): boolean {
  if (!PROTECTED_WRITE_METHODS.has(method.toUpperCase())) return false;
  const p = pathname.replace(/^\/functions\/v1/, '').replace(/^\/make-server-93a20b6f/, '').replace(/\/+$/, '');
  return PROTECTED_WRITE_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`));
}

