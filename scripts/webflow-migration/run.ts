/**
 * Inventura URL z Webflow + plán přesměrování na nový marketing web.
 *
 * Výstupy (do složky migration/):
 * - url-inventory.csv — všechny nalezené URL (sitemap + extra vstupy)
 * - redirect-plan.csv — path → cíl + rule id (pro CDN / SEO audit)
 * - summary.json — počty podle rule_id
 *
 * Volitelné vstupy:
 * - input/extra-urls.txt — jedna absolutní nebo relativní URL na řádek (řádky # ignorovat)
 * - input/gsc-pages.csv — export Search Console (gitignored); první sloupec = URL
 *
 * Ruční výjimky nad pravidly: upravte `src/config/webflowLegacyManualOverrides.ts`.
 *
 * Spuštění z kořene projektu: npm run webflow-migration
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeLegacyPathname,
  resolveWebflowLegacyWithFallback,
  type LegacyRedirectResolution,
} from '../../src/config/webflowLegacyRedirects.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const MIGRATION_DIR = join(ROOT, 'migration');
const INPUT_DIR = join(__dirname, 'input');

const SITEMAP_URL = 'https://vividbooks.com/sitemap.xml';

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseLocUrls(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const u = m[1]?.trim();
    if (u) out.push(u);
  }
  return out;
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'VividbooksWebflowMigrationScript/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function loadExtraUrls(): string[] {
  const p = join(INPUT_DIR, 'extra-urls.txt');
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, 'utf8').split(/\r?\n/);
  const urls: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    urls.push(t);
  }
  return urls;
}

function maybeParseGscRow(line: string): string | null {
  const parts = line.split(',');
  if (parts.length < 1) return null;
  const first = parts[0]?.replace(/^"|"$/g, '').trim();
  if (!first || first.toLowerCase() === 'page' || first.toLowerCase() === 'url') return null;
  if (first.startsWith('http')) return first;
  return null;
}

function loadGscUrls(): string[] {
  const p = join(INPUT_DIR, 'gsc-pages.csv');
  if (!existsSync(p)) return [];
  const text = readFileSync(p, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const urls: string[] = [];
  for (const line of lines) {
    const cell0 = line.split(',')[0]?.replace(/^"|"$/g, '').trim() ?? '';
    if (!cell0 || /^(page|url|top pages)$/i.test(cell0)) continue;
    const u = maybeParseGscRow(line);
    if (u) urls.push(u);
  }
  return urls;
}

function toPath(urlStr: string): string | null {
  try {
    const u = urlStr.includes('://') ? new URL(urlStr) : new URL(urlStr, 'https://vividbooks.com');
    if (!/vividbooks\.com$/i.test(u.hostname) && u.hostname !== 'www.vividbooks.com') {
      return null;
    }
    if (/^app\.vividbooks\.com$/i.test(u.hostname)) return null;
    return normalizeLegacyPathname(u.pathname);
  } catch {
    return null;
  }
}

function resolutionRow(path: string, r: LegacyRedirectResolution): {
  path: string;
  kind: string;
  target: string;
  ruleId: string;
  isFallback: boolean;
} {
  if (r.kind === 'none')
    return { path, kind: 'none', target: '', ruleId: '', isFallback: false };
  const isFallback = r.ruleId.startsWith('fallback.');
  const kind = r.kind;
  const target = r.kind === 'external' || r.kind === 'internal' ? r.target : '';
  return { path, kind, target, ruleId: r.ruleId, isFallback };
}

async function main() {
  mkdirSync(MIGRATION_DIR, { recursive: true });
  mkdirSync(INPUT_DIR, { recursive: true });

  console.log(`Stahuji ${SITEMAP_URL} …`);
  const xml = await fetchText(SITEMAP_URL);
  const sitemapUrls = parseLocUrls(xml);

  const extra = loadExtraUrls();
  const gsc = loadGscUrls();

  const allUrls = [...sitemapUrls, ...extra, ...gsc];
  const pathSet = new Map<string, string>();
  for (const u of allUrls) {
    const path = toPath(u);
    if (!path) continue;
    if (!pathSet.has(path)) pathSet.set(path, u.startsWith('http') ? u : `https://vividbooks.com${path}`);
  }
  const paths = [...pathSet.keys()].sort();

  const sortedEntries = [...pathSet.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const inventoryLines = [
    'source_url,path',
    ...sortedEntries.map(([p, src]) => `${escapeCsv(src)},${escapeCsv(p)}`),
  ];
  writeFileSync(join(MIGRATION_DIR, 'url-inventory.csv'), `${inventoryLines.join('\n')}\n`, 'utf8');

  const planRows: string[] = ['path,redirect_kind,target,rule_id,is_fallback'];
  const counts = new Map<string, number>();

  for (const path of paths) {
    const res = resolveWebflowLegacyWithFallback(path);

    if (res.kind === 'none') {
      planRows.push(`${escapeCsv(path)},none,,,false`);
      continue;
    }

    const row = resolutionRow(path, res);
    const fallbackFlag = row.isFallback ? 'true' : 'false';
    planRows.push(
      `${escapeCsv(row.path)},${escapeCsv(row.kind)},${escapeCsv(row.target)},${escapeCsv(row.ruleId)},${fallbackFlag}`,
    );
    counts.set(row.ruleId, (counts.get(row.ruleId) ?? 0) + 1);
  }

  writeFileSync(join(MIGRATION_DIR, 'redirect-plan.csv'), `${planRows.join('\n')}\n`, 'utf8');

  const summary = {
    generatedAt: new Date().toISOString(),
    sitemapUrlCount: sitemapUrls.length,
    uniquePaths: paths.length,
    extraUrlsLoaded: extra.length,
    gscUrlsLoaded: gsc.length,
    ruleCounts: Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1])),
  };
  writeFileSync(join(MIGRATION_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`Hotovo: ${paths.length} unikátních cest → ${MIGRATION_DIR}/`);
  console.log(JSON.stringify(summary.ruleCounts, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
