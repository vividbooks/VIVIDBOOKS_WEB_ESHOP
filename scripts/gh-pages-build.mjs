/**
 * Produkční build do složky `docs/` pro GitHub Pages (zdroj „Deploy from branch“ / docs).
 * Nesmaže *.md v docs/ — odstraní jen předchozí výstup Vite (assets, index.html).
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs');

const clean = (rel) => {
  const p = path.join(docs, rel);
  if (!existsSync(p)) return;
  rmSync(p, { recursive: true, force: true });
};

clean('assets');
for (const f of ['index.html', 'vite.svg', 'robots.txt']) {
  clean(f);
}

// GitHub Pages: vypnout Jekyll, ať se nerozbije SPA / podcesty
writeFileSync(path.join(docs, '.nojekyll'), '');

execSync('vite build', {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    DOCS_BUILD: '1',
    GH_PAGES: 'true',
  },
});
