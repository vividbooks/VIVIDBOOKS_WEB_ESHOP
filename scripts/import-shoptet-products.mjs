#!/usr/bin/env node
/**
 * Import produktů ze Shoptetu (productsComplete.xml) do katalogu (KV přes Edge).
 *
 * Filtruje jen kořenové kategorie:
 *   - Nástěnné obrazy a tabule
 *   - Žákovské knížky
 *
 * Jedna položka katalogu = jedna varianta (cena / kód / velikost).
 *
 * Použití:
 *   node scripts/import-shoptet-products.mjs ./productsComplete.xml
 *   node scripts/import-shoptet-products.mjs --url 'https://.../productsComplete.xml?...'
 *   node scripts/import-shoptet-products.mjs ./file.xml --apply
 *   node scripts/import-shoptet-products.mjs ./file.xml --apply --skip-existing
 *
 * Bez --apply jen vypíše JSON náhled a počty (dry run).
 *
 * Pozn.: Pro „Přidat do košíku“ přes Stripe je potřeba doplnit shopifyVariantId
 * (např. nástrojem ShopifyLinker v adminu). shoptetId = kód varianty (SKU) pro sklad.
 *
 * Parsování je v adminu sdílené přes src/utils/shoptetProductsXmlImport.ts — při úpravě
 * filtrů/kategorií uprav i tento skript, nebo použij Admin → Migrace obsahu.
 */

import fs from 'node:fs';
import process from 'node:process';

/** Drž v souladu s src/utils/supabase/info.tsx */
const PROJECT_ID = 'iekkundgizzdbmkzatdl';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlla2t1bmRnaXp6ZGJta3phdGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjYwMDIsImV4cCI6MjA4OTUwMjAwMn0.PsD7gEnhCushlJwnCkFIwfrGLws0KFa0QsCb54_6WHk';

const PRODUCTS_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-93a20b6f/products`;

const ALLOWED_ROOTS = new Set(['Nástěnné obrazy a tabule', 'Žákovské knížky']);

function decodeXmlText(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripHtml(html) {
  let t = decodeXmlText(html);
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/p>/gi, '\n');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t.slice(0, 8000);
}

function firstMatch(re, text, group = 1) {
  const m = re.exec(text);
  return m ? m[group] : '';
}

function allMatches(re, text, group = 1) {
  const out = [];
  let m;
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  while ((m = r.exec(text))) out.push(m[group]);
  return out;
}

function parseCdata(tagName, block) {
  const re = new RegExp(`<${tagName}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`, 'i');
  const m = re.exec(block);
  if (m) return m[1];
  const re2 = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
  const m2 = re2.exec(block);
  return m2 ? m2[1] : '';
}

function categorySegmentKey(s) {
  return decodeXmlText(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function matchAllowedCategoryInPath(pathRaw) {
  const segments = decodeXmlText(pathRaw)
    .split(/\s*>\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  const keys = new Map();
  for (const allowed of ALLOWED_ROOTS) {
    keys.set(categorySegmentKey(allowed), allowed);
  }
  for (let i = 0; i < segments.length; i++) {
    const canonical = keys.get(categorySegmentKey(segments[i]));
    if (canonical) {
      return { canonical, subTail: segments.slice(i + 1) };
    }
  }
  return null;
}

function itemAllowed(categoriesBlock) {
  const tryPath = (pathInner) => {
    const hit = matchAllowedCategoryInPath(pathInner);
    if (!hit) return null;
    const sub = hit.subTail.length ? hit.subTail.join(' › ') : '';
    return { merchCategory: hit.canonical, merchSubcategory: sub };
  };

  const def = firstMatch(/<DEFAULT_CATEGORY[^>]*>([\s\S]*?)<\/DEFAULT_CATEGORY>/i, categoriesBlock, 1);
  const fromDef = tryPath(def);
  if (fromDef) return { ok: true, ...fromDef };

  const cats = allMatches(/<CATEGORY[^>]*>([\s\S]*?)<\/CATEGORY>/gi, categoriesBlock, 1);
  for (const c of cats) {
    const fromCat = tryPath(c);
    if (fromCat) return { ok: true, ...fromCat };
  }
  return { ok: false, merchCategory: '', merchSubcategory: '' };
}

function parseVariantParams(variantBlock) {
  const names = allMatches(/<PARAMETER>\s*<NAME>([\s\S]*?)<\/NAME>/gi, variantBlock, 1);
  const values = allMatches(/<VALUE>([\s\S]*?)<\/VALUE>/gi, variantBlock, 1);
  const map = {};
  for (let i = 0; i < names.length && i < values.length; i++) {
    map[decodeXmlText(names[i]).trim()] = decodeXmlText(values[i]).trim();
  }
  return map;
}

function normalizeShoptetImageUrl(raw) {
  const t = decodeXmlText(raw).trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  return '';
}

function urlsFromImageTagBody(inner) {
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(inner);
  const payload = (cdata ? cdata[1] : inner).trim();
  if (!payload) return [];
  const u = normalizeShoptetImageUrl(payload);
  return u ? [u] : [];
}

function parseImageTagsInFragment(fragment) {
  const urls = [];
  const imgRe = /<IMAGE\b[^>]*>([\s\S]*?)<\/IMAGE>/gi;
  let im;
  while ((im = imgRe.exec(fragment))) {
    urls.push(...urlsFromImageTagBody(im[1]));
  }
  return urls;
}

function resolveShoptetImageRef(refRaw, gallery) {
  const ref = decodeXmlText(refRaw).trim();
  if (!ref) return '';
  const asUrl = normalizeShoptetImageUrl(ref);
  if (asUrl) return asUrl;
  const n = parseInt(ref, 10);
  if (!Number.isFinite(n) || gallery.length === 0) return '';
  if (n >= 1 && n <= gallery.length) return gallery[n - 1];
  if (n >= 0 && n < gallery.length) return gallery[n];
  return '';
}

function extractShoptetShopItemImageUrls(block) {
  const imagesSection = firstMatch(/<IMAGES>([\s\S]*?)<\/IMAGES>/i, block, 1);
  const gallery = parseImageTagsInFragment(imagesSection || '');
  const loose = imagesSection ? [] : parseImageTagsInFragment(block);
  const baseGallery = gallery.length ? gallery : loose;

  const refs = allMatches(/<IMAGE_REF>([\s\S]*?)<\/IMAGE_REF>/gi, block, 1);
  const fromRefs = [];
  for (const r of refs) {
    const u = resolveShoptetImageRef(r, baseGallery);
    if (u) fromRefs.push(u);
  }

  const seen = new Set();
  const ordered = [];
  for (const u of [...baseGallery, ...fromRefs]) {
    if (u && !seen.has(u)) {
      seen.add(u);
      ordered.push(u);
    }
  }
  return ordered;
}

function shopItemHeadBeforeVariants(block) {
  const idx = block.search(/<VARIANT\b/i);
  return idx < 0 ? block : block.slice(0, idx);
}

function parseItemLevelCodeAndPrice(block, shoptetProductId) {
  const head = shopItemHeadBeforeVariants(block);
  let code = decodeXmlText(firstMatch(/<CODE>([\s\S]*?)<\/CODE>/i, head, 1)).trim();
  if (!code) code = decodeXmlText(firstMatch(/<EAN>([\s\S]*?)<\/EAN>/i, head, 1)).trim();
  if (!code) code = decodeXmlText(firstMatch(/<PRODUCTNO>([\s\S]*?)<\/PRODUCTNO>/i, head, 1)).trim();
  const priceVatRaw = firstMatch(/<PRICE_VAT>([\s\S]*?)<\/PRICE_VAT>/i, head, 1).trim();
  if (!priceVatRaw) return null;
  const priceAmount = Number(priceVatRaw.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(priceAmount)) return null;
  return { code: code || `shoptet-item-${shoptetProductId}`, priceAmount };
}

function parseShopItem(block, id) {
  const name = decodeXmlText(firstMatch(/<NAME>([\s\S]*?)<\/NAME>/i, block, 1)).trim();
  const catSection = firstMatch(/<CATEGORIES>([\s\S]*?)<\/CATEGORIES>/i, block, 1) || '';
  const { ok, merchCategory, merchSubcategory: merchSubFromPath } = itemAllowed(catSection);
  if (!ok) return [];

  const merchSubcategory = merchSubFromPath.trim();

  const imageUrls = extractShoptetShopItemImageUrls(block);
  const image = imageUrls[0] || '';

  let description = parseCdata('DESCRIPTION', block);
  if (!description.trim()) description = parseCdata('SHORT_DESCRIPTION', block);
  description = stripHtml(description);

  const variantRe = /<VARIANT\s+id="(\d+)">([\s\S]*?)<\/VARIANT>/gi;
  const products = [];
  let vm;
  while ((vm = variantRe.exec(block))) {
    const vid = vm[1];
    const vb = vm[2];
    const code = decodeXmlText(firstMatch(/<CODE>([\s\S]*?)<\/CODE>/i, vb, 1)).trim();
    const priceVatRaw = firstMatch(/<PRICE_VAT>([\s\S]*?)<\/PRICE_VAT>/i, vb, 1).trim();
    const priceAmount = Number(priceVatRaw.replace(/\s/g, '').replace(',', '.'));
    if (!code || !Number.isFinite(priceAmount)) continue;

    const params = parseVariantParams(vb);
    const sizeLabel = params['Velikost'] || params['velikost'] || '';
    const displayName = sizeLabel ? `${name} – ${sizeLabel}` : name;

    products.push({
      id: `shoptet-v-${vid}`,
      name: displayName,
      price: `${Math.round(priceAmount)} Kč`,
      priceAmount: Math.round(priceAmount),
      category: merchCategory,
      type: 'merch',
      merchCategory,
      merchSubcategory: merchSubcategory || sizeLabel || undefined,
      image: image || undefined,
      ...(imageUrls.length > 1 ? { images: imageUrls } : {}),
      description: description || undefined,
      buttonType: 'cart',
      shoptetId: code,
      metadata: {
        shoptetProductId: id,
        shoptetVariantId: vid,
        shoptetVariantCode: code,
        source: 'shoptet-import',
      },
    });
  }

  if (products.length === 0) {
    const fb = parseItemLevelCodeAndPrice(block, id);
    if (fb) {
      products.push({
        id: `shoptet-v-${id}`,
        name,
        price: `${Math.round(fb.priceAmount)} Kč`,
        priceAmount: Math.round(fb.priceAmount),
        category: merchCategory,
        type: 'merch',
        merchCategory,
        merchSubcategory: merchSubcategory || undefined,
        image: image || undefined,
        ...(imageUrls.length > 1 ? { images: imageUrls } : {}),
        description: description || undefined,
        buttonType: 'cart',
        shoptetId: fb.code,
        metadata: {
          shoptetProductId: id,
          shoptetVariantId: id,
          shoptetVariantCode: fb.code,
          source: 'shoptet-import',
        },
      });
    }
  }

  return products;
}

function parseXml(xml) {
  const out = [];
  const itemRe = /<SHOPITEM\s+id="(\d+)">([\s\S]*?)<\/SHOPITEM>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    out.push(...parseShopItem(m[2], m[1]));
  }
  return out;
}

async function loadXml(source) {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${source}`);
    return res.text();
  }
  return fs.readFileSync(source, 'utf8');
}

async function fetchExistingIds() {
  const res = await fetch(PRODUCTS_URL, {
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`GET products failed: ${res.status}`);
  const data = await res.json();
  const list = data.products || [];
  return new Set(list.map((p) => String(p.id)));
}

async function postProduct(body) {
  const res = await fetch(PRODUCTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

function parseArgs(argv) {
  const args = { apply: false, skipExisting: false, source: null };
  for (const a of argv) {
    if (a === '--apply') args.apply = true;
    else if (a === '--skip-existing') args.skipExisting = true;
    else if (a.startsWith('--url=')) args.source = a.slice(6);
    else if (!a.startsWith('-')) args.source = a;
  }
  return args;
}

async function main() {
  const argv = process.argv.slice(2);
  const { apply, skipExisting, source } = parseArgs(argv);
  if (!source) {
    console.error(
      'Usage: node scripts/import-shoptet-products.mjs <file.xml|--url=...> [--apply] [--skip-existing]',
    );
    process.exit(1);
  }

  const xml = await loadXml(source);
  const products = parseXml(xml);

  const byCat = new Map();
  for (const p of products) {
    const k = p.merchCategory || '?';
    byCat.set(k, (byCat.get(k) || 0) + 1);
  }

  console.error(`Parsed ${products.length} variant rows (filtered categories).`);
  for (const [k, n] of byCat) console.error(`  ${k}: ${n}`);

  if (!apply) {
    console.log(JSON.stringify(products, null, 2));
    console.error('\nDry run. Přidej --apply pro odeslání na /products.');
    return;
  }

  let existing = new Set();
  if (skipExisting) {
    existing = await fetchExistingIds();
    console.error(`Existing product ids in KV: ${existing.size}`);
  }

  let ok = 0;
  let skip = 0;
  let fail = 0;
  for (const p of products) {
    if (skipExisting && existing.has(p.id)) {
      skip++;
      continue;
    }
    const r = await postProduct(p);
    if (r.ok) {
      ok++;
      existing.add(p.id);
    } else {
      fail++;
      console.error(`FAIL ${p.id} ${p.name}:`, r.status, r.json);
    }
  }
  console.error(`Done. posted=${ok} skipped=${skip} failed=${fail}`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
