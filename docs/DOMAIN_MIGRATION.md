# Domain Migration Checklist

## Scope

Tento projekt teď používá sdílenou konfiguraci veřejné domény pro:
- frontend canonical / OG / structured data
- GitHub Pages build (`VITE_PUBLIC_SITE_URL`)
- Supabase Edge e-maily, `robots.txt`, `llms.txt`, `sitemap.xml` (`PUBLIC_SITE_URL`)
- admin CTA buildery
- assistant scrape blogu a webinářů

Nemění se automaticky tyto samostatné služby:
- `https://app.vividbooks.com`
- `https://api.vividbooks.com`
- `https://www.vividbooks.cz` (např. GDPR), pokud je sami nepřesměrujete jinam

## Přesměrování `eshop.vividbooks.com` → `www.vividbooks.com`

Starý Shoptet běží na `eshop.vividbooks.com`. Nový katalog a objednávky jsou na `www.vividbooks.com`.

### 1. DNS / Shoptet (nutné pro 301 na celou doménu)

V administraci Shoptetu nastavte **301 redirect celého e-shopu** na `https://www.vividbooks.com/`  
(nebo v DNS nasměrujte `eshop.vividbooks.com` na stejný hosting jako www a nechte SPA přesměrování).

Export XML z Shoptetu (`/export/…`) zůstává na `eshop.vividbooks.com` — proxy `admin/shoptet-products-xml-fetch` to vyžaduje.

### 2. SPA mapa cest (v repozitáři)

Po nasazení frontendu platí `src/config/eshopLegacyRedirects.ts` — cesty ze sitemap Shoptetu
(např. `/prvouka/`, `/pracovni-sesit-matematika/…`) se přemapují na `/predmet/…`, `/katalog`, `/objednat`.

### 3. SEO

- V Google Search Console přidejte přesměrování domény nebo change of address.
- Sitemap nového webu: `https://www.vividbooks.com/sitemap.xml` (statická + produkty z API).
- Stará sitemap Shoptetu (`eshop.vividbooks.com/sitemap.xml`) po redirectu přestane být relevantní.

## Cutover na `new.vividbooks.com`

1. GitHub Pages:
   - `Settings -> Pages -> Source: GitHub Actions`
   - custom domain `new.vividbooks.com`
   - zapnuté HTTPS
2. DNS:
   - nasměrovat `new.vividbooks.com` na GitHub Pages
3. GitHub Actions secrets:
   - `VITE_PUBLIC_SITE_URL=https://new.vividbooks.com`
   - zkontrolovat i `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_PACKETA_API_KEY`, `VITE_TWITTER_SITE`, `VITE_GA_MEASUREMENT_ID`
4. Supabase Edge secrets:
   - `PUBLIC_SITE_URL=https://new.vividbooks.com`
   - `PUBLIC_ESHOP_URL=...`, pokud SPA běží jinde než hlavní marketingový web
   - volitelně `NEWSLETTER_PRIVACY_URL`, pokud GDPR stránka není na `www.vividbooks.cz`
5. Redeploy:
   - znovu spustit GitHub Pages workflow
   - redeploy `make-server-93a20b6f`, pokud se změnil serverový handler nebo secrets
6. Ověření:
   - canonical / OG na několika stránkách
   - `https://new.vividbooks.com/api/sitemap.xml`
   - `https://new.vividbooks.com/api/robots.txt`
   - objednávkové a webinářové e-maily vedou na `new.vividbooks.com`
   - assistant scrape čte `new.vividbooks.com/cs/webinare` a `new.vividbooks.com/cs/blog`

## Finální cutover na `vividbooks.com` nebo `www.vividbooks.com`

1. Rozhodnout jednu kanonickou variantu hostu.
2. Přepnout DNS a GitHub Pages custom domain.
3. Aktualizovat:
   - `CNAME`
   - `docs/CNAME`
   - `VITE_PUBLIC_SITE_URL`
   - `PUBLIC_SITE_URL`
   - případně `PUBLIC_ESHOP_URL`
4. Znovu nasadit frontend a ověřit, že sitemapa a canonical už nepoužívají `new.vividbooks.com`.
5. Nastavit redirect ze `new.vividbooks.com` na finální host.

## Third-party checklist

### Stripe
- webhook URL na Supabase se nemění jen kvůli doméně webu
- ověřit Apple Pay / Google Pay doménovou verifikaci pro nový host

### Search / analytics
- Google Search Console: přidat a ověřit nový host
- znovu nahrát sitemapu
- ověřit GA4 / případně Meta preview a sociální share debug

### E-mail / marketing
- Mandrill / Mailchimp šablony a CTA vedou na správný host
- `NEWSLETTER_PRIVACY_URL` odpovídá skutečné GDPR stránce

### Ostatní
- `app.vividbooks.com`, `api.vividbooks.com`, `eshop.vividbooks.com` zůstávají samostatně, pokud jejich migraci neřešíte zvlášť
