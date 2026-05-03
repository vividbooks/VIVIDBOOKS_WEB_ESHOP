# Webflow → nový web: přesměrování a otevřené otázky

Tento dokument shrnuje **kam co směřuje** v kódu, **schválená rozhodnutí** k přesměrováním a jak je to se **Shoptetem**.

## Jak to držet aktuální

1. **Zdroj pravdy logiky** — [`src/config/webflowLegacyRedirects.ts`](../src/config/webflowLegacyRedirects.ts)  
2. **Mapy slugů + `/links/` → Shoptet / interní** — [`src/config/webflowLegacySlugMaps.ts`](../src/config/webflowLegacySlugMaps.ts)  
3. **Ruční výjimky (klíč = přesná stará cesta)** — [`src/config/webflowLegacyManualOverrides.ts`](../src/config/webflowLegacyManualOverrides.ts)  
4. **Inventura ze živé sitemap** — z kořene monorepa nebo z `Web vividbooks`:

   ```bash
   npm run webflow-migration
   ```

5. **Vygenerované soubory** — složka [`migration/`](../migration/):

   | Soubor | Obsah |
   |--------|--------|
   | `url-inventory.csv` | zdrojová URL + normalizovaná cesta |
   | `redirect-plan.csv` | cesta → typ přesměrování, cíl, `rule_id`, zda jde o fallback |
   | `summary.json` | počty podle `rule_id` |

Volitelně: `scripts/webflow-migration/input/extra-urls.txt`, `gsc-pages.csv` (gitignored — citlivý export).

---

## Přehled pravidel (co kam typicky padá)

### Prefix — zachová se „ocas“ cesty

| Starý prefix | Nový prefix / cíl | Poznámka |
|--------------|-------------------|----------|
| `/cs/blog/` | `/blog/{slug}` nebo **`/blog`** | Zmapované staré slugy → čtyři články ze seedu (`LEGACY_CS_BLOG_SLUG_MAP`); ostatní články → přehled `/blog`. |
| `/en/blog/`, `/es/blog/` | `/blog/` | Slug se kopíruje; závisí na obsahu v CMS. |
| `/app-news/` | `/novinky/{slug}` nebo **`/novinky`** | Všechny známé Webflow slugy přemapované v `LEGACY_APP_NEWS_TO_NOVINKA_SLUG`; nové neznámé slugy → `/novinky`. |

### Prefix — celá podsložka se „zhrne“ na jednu stránku

| Starý prefix | Cíl |
|--------------|-----|
| `/cs/vividboard/` | `/vividboard` |
| `/dvpp-webinare/` | `/webinare` |
| `/jobs/` | `/kontakt` |
| `/cs/kampan/` | **`/`** (starší kampaně na homepage) |
| `/cs/studenti-ucitelstvi/` | `/vyzkousejte` |

**`/links/*`** do této skupiny nepatří — každý slug má vlastní cíl (Shoptet nebo interní stránka); viz [`webflowLegacySlugMaps.ts`](../src/config/webflowLegacySlugMaps.ts).

### Jednorázové přesné cesty (vzorek)

Kompletní seznam je v kódu v poli `LEGACY_EXACT_INTERNAL` a v `redirect-plan.csv`. Typické příklady:

| Stará cesta | Cíl |
|-------------|-----|
| `/cs/cenik` | `/objednat` |
| `/cs/kontakt`, `/en/contact`, … | `/kontakt` |
| `/en/pricing`, `/es/precios` | `/objednat` |
| `/cs/fyzika`, `/cs/chemie`, … (schválené slugy) | `/predmet/{slug}` (matematika má více aliasů → jedna stránka `/predmet/matematika`) |
| `/en/physics`, `/en/chemistry`, `/es/fisica`, … | příslušný `/predmet/…` |
| `/cs/free-trial…` (jakákoli URL obsahující `free-trial`) | `/vyzkousejte` |
| `/cs/ukazky…` | `/vyzkousejte` |
| `/cs/otevrit-ucebnice` | **`/`** (homepage; bez deep linku do aplikace) |
| `/docs/*` | `/` (viz níže — nejistota) |
| `/privacy-policy` | `/` |
| `/hvezda-vyuky`, `/hviezda-vyucby` | `/akce` |

### Speciální: `/school/cz|sk/…`

Zkusí se „namapovat“ jako zbytek cesty po `/school/…`; když to nesedí, fallback **`/`** (`rule_id`: `fallback.school`). V aktuální sitemapě jsou např.:

- `/school/cz/cenik-bckp-nemazat`
- `/school/cz/fy-che-old`
- `/school/sk/cennik-hidden`
- `/school/sk/katalog-registracia`

→ dnes vše **/** — potřebuji od tebe cíle nebo smět smazat z indexace.

---

## Rozhodnutí (aktualizováno)

1. **`/docs/*`** — zatím beze změny na **`/`**; případné PDF / konkrétní cíle doplníme dodatečně.

2. **`/links/*`** — **zachovat jako externí / smysluplné cíle.** Konkrétní mapa je v [`webflowLegacySlugMaps.ts`](../src/config/webflowLegacySlugMaps.ts) (`LEGACY_SHORT_LINK_TARGETS`): většina katalogů a objednávek → [`https://eshop.vividbooks.com/`](https://eshop.vividbooks.com/), kontaktové zkratky → `/kontakt`, školení / letní škola ředitelů → `/webinare`, prvoukalekce → kategorie nebo konkrétní produkt na Shoptetu. **Neznámý** `/links/…` → homepage Shoptetu (`external.links-default`).  
   Doménu marketingu (`www` vs. budoucí `new.`) řeší CDN až po publishi nového webu — samotné URL Shoptetu zůstávají na `eshop.vividbooks.com`.

3. **`/app-news/{slug}`** — explicitní mapa na existující slugy novinek + fallback **`/novinky`**.

4. **Blog `/cs/blog/{slug}`** — tři známé články mapované na seed slugy; ostatní **`/blog`**.

5. **`free-trial`** — vždy **`/vyzkousejte`**.

6. **`/cs/interaktivni-licence`** — **`/`**.

7. **EN/ES „O nás“** — zatím **`/`** (beze změny).

8. **Newsletter / GDPR / starší kampaně** — jako dosud přesné pravidla na **`/`**; **`/cs/kampan/*`** navíc celá podsložka → **`/`**.

9. **`/cs/nasi-zakaznici`, `/cs/proc-to-delame`** — **`/`** (stránky nebudou).

10. **`/cs/otevrit-ucebnice`** — **`/`** (ne externí aplikace).

---

## Shoptet — máme napojení?

**Ano, ale jen pro vybraný úsek katalogu z XML exportu**, ne jako automatická „kopie celého starého Shoptetu“.

### Kde to v produktu je

| Mechanismus | Účel |
|-------------|------|
| **Admin → Migrace obsahu** ([`MigrationPage.tsx`](../src/components/admin/MigrationPage.tsx)) | Načtení **productsComplete.xml** z URL (přes Edge endpoint kvůli CORS) nebo z lokálního souboru; náhled; import vybraných řádků do katalogu (Supabase KV). |
| **CLI** [`scripts/import-shoptet-products.mjs`](../scripts/import-shoptet-products.mjs) | `node scripts/import-shoptet-products.mjs ./productsComplete.xml [--apply] [--skip-existing]` |
| **Edge** | Stažení XML: `admin/shoptet-products-xml-fetch` (povolené URL z `eshop.vividbooks.com/export/…`). |

### Co se z Shoptetu bere

Z [`shoptetProductsXmlImport.ts`](../src/utils/shoptetProductsXmlImport.ts) — importované jsou jen produkty ve stromu kategorií s kořenem:

- **„Nástěnné obrazy a tabule“**
- **„Žákovské knížky“**

→ typ **`merch`** v katalogu, varianty (velikosti) uvnitř záznamu, pole **`shoptetId`** pro sklad / párování.  
**Ostatní kategorie z XML se ignorují** — hlavní učebnice/objednávková logika u vás typicky běží přes **Shopify varianty + vlastní produkty**, ne přes celý Shoptet dump.

### Co z toho plyne pro „starý Shoptet“

- Pokud potřebuješ **všechny** produktové řádky ze starého Shoptetu v novém katalogu, je potřeba buď **rozšířit `SHOPTET_IMPORT_ALLOWED_ROOTS` / filtrování** v `shoptetProductsXmlImport.ts` (a sladit s CLI skriptem), nebo produkty založit/jinak migrovat (ručně, CSV, jiný export).
- Po importu merchu často musíš doplnit **`shopifyVariantId`** u variant (platby Stripe) — viz text v Migraci obsahu.

---

## Poznámka k SEO

Klientské přesměrování v SPA (**[`WebflowLegacyRedirect.tsx`](../src/components/WebflowLegacyRedirect.tsx)**) je náhrada za hosting bez serverových 301. Pro ostrý přechod domény z Webflow doporučuju ještě **HTTP 301 na CDN / proxy** podle `migration/redirect-plan.csv`.

---

*Vygenerované počty v tomto dokumentu odpovídají poslednímu běhu `npm run webflow-migration`; po změně pravidel je přegeneruj.*
