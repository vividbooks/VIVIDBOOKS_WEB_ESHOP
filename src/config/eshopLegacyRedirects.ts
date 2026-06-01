import { MARKETING_ORIGIN_PRIMARY_DEFAULT } from './marketingSiteConstants';

/** Starý Shoptet e-shop — přesměrování na www.vividbooks.com. */
export const ESHOP_LEGACY_HOST = 'eshop.vividbooks.com';

export const ESHOP_REDIRECT_TARGET_ORIGIN = MARKETING_ORIGIN_PRIMARY_DEFAULT;

function normalizeEshopPath(pathname: string): string {
  const raw = String(pathname || '/').split('?')[0].split('#')[0];
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const trimmed = withSlash.replace(/\/+$/, '') || '/';
  return trimmed.toLowerCase();
}

/** Přesná shoda cest z https://eshop.vividbooks.com/sitemap.xml (2026-06). */
const ESHOP_EXACT_PATH_TARGETS: Record<string, string> = {
  '/': '/',
  '/cesky-jazyk': '/predmet/cesky-jazyk',
  '/chemie': '/predmet/chemie',
  '/clovek': '/predmet/prirodopis',
  '/digitalni-licence': '/vyzkousejte',
  '/digitalni-licence-pro-jednotlivce': '/vyzkousejte',
  '/druhy-stupen': '/katalog',
  '/jak-nakupovat': '/objednat',
  '/kontakty': '/kontakt',
  '/matematika': '/predmet/matematika-2-stupen',
  '/nase-novinky': '/novinky',
  '/nastenne-obrazy-a-tabule': '/dalsi-produkty',
  '/obchodni-podminky': '/kontakt',
  '/podminky-ochrany-osobnich-udaju': '/kontakt',
  '/pracovni-sesit-chemie': '/predmet/chemie',
  '/pracovni-sesit-chemie-1-dil': '/predmet/chemie',
  '/pracovni-sesit-chemie-2-dil': '/predmet/chemie',
  '/pracovni-sesit-fyzika': '/predmet/fyzika',
  '/pracovni-sesit-fyzika-6-trida': '/predmet/fyzika',
  '/pracovni-sesit-fyzika-7-trida': '/predmet/fyzika',
  '/pracovni-sesit-fyzika-8-trida': '/predmet/fyzika',
  '/pracovni-sesit-fyzika-9-trida': '/predmet/fyzika',
  '/pracovni-sesit-matematika': '/predmet/matematika-2-stupen',
  '/pracovni-sesit-matematika-61': '/predmet/matematika-2-stupen',
  '/pracovni-sesit-matematika-6-2': '/predmet/matematika-2-stupen',
  '/pracovni-sesit-prirodopis': '/predmet/prirodopis',
  '/pracovni-sesit-prirodopis-6-trida': '/predmet/prirodopis',
  '/pracovni-sesit-prirodopisu-pro-7-rocnik': '/predmet/prirodopis',
  '/pracovni-sesit-prirodopisu-pro-8-rocnik': '/predmet/prirodopis',
  '/pracovni-sesit-prirodopisu-pro-9-rocnik': '/predmet/prirodopis',
  '/pracovni-sesity': '/katalog',
  '/pracovni-sesit-matematiky-pro-1-rocnik-1-dil': '/predmet/matematika-1-stupen',
  '/pracovni-sesit-matematiky-pro-7--tridu---1--dil': '/predmet/matematika-2-stupen',
  '/pracovni-sesit-matematiky-pro-7--tridu---2--dil': '/predmet/matematika-2-stupen',
  '/pracovni-sesit-matematiky-pro-8-rocnik-1-dil': '/predmet/matematika-2-stupen',
  '/pracovni-sesit-matematiky-pro-8--rocnik---2--dil': '/predmet/matematika-2-stupen',
  '/pracovni-sesit-matematiky-pro-9-rocnik-1-dil': '/predmet/matematika-2-stupen',
  '/pracovni-sesit-matematiky-pro-9-rocnik-2dil': '/predmet/matematika-2-stupen',
  '/pracovni-ucebnice-matematiky-pro-1-rocnik-3-dil': '/predmet/matematika-1-stupen',
  '/pracovni-ucebnice-matematiky-pro-1rocnik-2-dil': '/predmet/matematika-1-stupen',
  '/pracovni-ucebnice-prvouky-pro-1-rocnik-1-dil': '/predmet/prvouka',
  '/pracovni-ucebnice-prvouky-pro-1-rocnik-2-dil': '/predmet/prvouka',
  '/prirodopis': '/predmet/prirodopis',
  '/prvouka': '/predmet/prvouka',
  '/skola': '/objednat',
  '/slavne-osobnosti': '/dalsi-produkty',
  '/zakovske-knizky': '/dalsi-produkty',
  '/zakovska-knizka-pro-1--rocnik': '/predmet/cesky-jazyk',
};

/** Prefix pravidla — plakáty, tabule, vyjmenovaná slova atd. */
const ESHOP_PREFIX_TARGETS: { prefix: string; target: string }[] = [
  { prefix: '/pracovni-sesit-matematiky', target: '/predmet/matematika-2-stupen' },
  { prefix: '/pracovni-sesit-matematika', target: '/predmet/matematika-2-stupen' },
  { prefix: '/pracovni-ucebnice-matematiky', target: '/predmet/matematika-1-stupen' },
  { prefix: '/pracovni-ucebnice-prvouky', target: '/predmet/prvouka' },
  { prefix: '/pracovni-sesit-prirodopis', target: '/predmet/prirodopis' },
  { prefix: '/pracovni-sesit-chemie', target: '/predmet/chemie' },
  { prefix: '/pracovni-sesit-fyzika', target: '/predmet/fyzika' },
  { prefix: '/vyjmenovana-slova', target: '/predmet/cesky-jazyk' },
  { prefix: '/nasobeni-cisla', target: '/predmet/matematika-1-stupen' },
  { prefix: '/nasobeni-cisla-', target: '/predmet/matematika-1-stupen' },
];

const ESHOP_DEFAULT_TARGET = '/katalog';

/** Cílová cesta na www.vividbooks.com (bez originu). */
export function resolveEshopLegacyPath(pathname: string): string {
  const path = normalizeEshopPath(pathname);
  const exact = ESHOP_EXACT_PATH_TARGETS[path];
  if (exact) return exact;

  const sortedPrefixes = [...ESHOP_PREFIX_TARGETS].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sortedPrefixes) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`) || path.startsWith(rule.prefix)) {
      return rule.target;
    }
  }

  return ESHOP_DEFAULT_TARGET;
}

export function buildEshopLegacyRedirectUrl(pathname: string, search = '', hash = ''): string {
  const targetPath = resolveEshopLegacyPath(pathname);
  const origin = ESHOP_REDIRECT_TARGET_ORIGIN.replace(/\/$/, '');
  return `${origin}${targetPath}${search || ''}${hash || ''}`;
}

export function isEshopLegacyHost(hostname: string): boolean {
  return hostname.replace(/^www\./, '').toLowerCase() === ESHOP_LEGACY_HOST;
}
