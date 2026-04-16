# Web Vividbooks — přehled projektu a konfigurace

Tento dokument je **zdroj pravdy** pro strukturu repozitáře, kde co běží a **jaké proměnné prostředí** se používají. Při práci na integracích ho používej jako první referenci (místo hádání).

Podrobné nasazení e‑shopu, Stripe a GitHub Pages: [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Co je v repozitáři

| Oblast | Popis |
|--------|--------|
| **Frontend** | Vite + React (`src/`). Statický build; produkce často GitHub Pages. |
| **Supabase** | Postgres, Auth, **Edge Functions** (`supabase/functions/`). Hlavní business logika e‑shopu, webinářů, admin API je v jednom velkém handleru importovaném ze `src/supabase/functions/server/`. |
| **KV / storage** | Edge funkce používají Supabase KV (viz `kv_store` v server kódu) pro produkty, webináře, registrace, atd. |
| **Klient Supabase v prohlížeči** | `src/utils/supabase/info.tsx` (autogenerované: `projectId`, `publicAnonKey`) + `src/lib/supabaseBrowser.ts`. |

### Důležité Edge funkce (názvy složek)

| Složka | Role |
|--------|------|
| `make-server-93a20b6f` | Hlavní API: produkty, objednávky, webináře, Mailchimp/Mandrill, RAG, Pipedrive, Slack, … Implementace: **`src/supabase/functions/server/index.tsx`**. |
| `make-server-954b19ad` | Asistent (Vividassistant) — sdílený import z `src/` nebo duplicitní kód; ověření allowlistu e‑mailů. |
| `stripe-webhook`, `create-payment-intent`, `process-export-queue`, … | E‑shop, platby, Basecom, iDoklad — viz [DEPLOYMENT.md](./DEPLOYMENT.md). |
| `sync-stock`, `admin-product-commerce`, … | Sklad a administrace produktů. |

Po změně **`src/supabase/functions/server/index.tsx`** je nutný **nový deploy** funkce `make-server-93a20b6f`, aby se změna projevila v produkci.

---

## Kde se co nastavuje

| Kde | Co tam patří |
|-----|----------------|
| **`.env` / GitHub Actions** (build) | Jen proměnné s prefixem **`VITE_`** — dostanou se do statického JS v době buildu. |
| **Supabase Dashboard → Edge Functions → Secrets** | Serverové tajemství: Stripe secret, Mailchimp, Mandrill, DB URL, service role, integrace. **Necommitovat do gitu.** |
| **`src/utils/supabase/info.tsx`** | Veřejný anon klíč a project ref (často generované nástrojem Supabase). |

---

## Frontend — `VITE_*` (build / lokálně)

| Proměnná | Účel |
|----------|------|
| `VITE_PUBLIC_SITE_URL` | Veřejná URL webu (odkazy, SSR fallback; např. `https://www.vividbooks.com`). |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Payment Element (`pk_…`). |
| `VITE_PACKETA_API_KEY` | Widget Zásilkovny na pokladně. |
| `VITE_TWITTER_SITE` | Volitelně — `og:twitter:site`. |
| `VITE_SHOW_PIPEDRIVE_ICO_DEBUG` | Trial / IČO debug. |
| `VITE_ASSISTANT_ALLOWLIST_OFF` | Asistent — vypnutí allowlistu (viz `src/config/assistantAllowlist.ts`). |
| `VITE_ASSISTANT_ALLOWED_EMAILS` | Seznam e‑mailů pro asistenta. |
| `VITE_ASSISTANT_EXTENDED_UI_EMAILS` | Rozšířené UI. |
| `VITE_ASSISTANT_RAG_WEB_DICTATION_EMAILS` | RAG + diktát. |

---

## Supabase Edge — společné

Tyto se objevují napříč funkcemi (`make-server-*`, webhooky, fronty):

| Proměnná | Účel |
|----------|------|
| `SUPABASE_URL` | URL projektu. |
| `SUPABASE_ANON_KEY` | Veřejný klíč (některé interní volání). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — privilegované operace. |
| `DATABASE_URL` / `SUPABASE_DB_URL` | Přímý Postgres (mnoho worker funkcí). |
| `PUBLIC_SITE_URL` | Odkazy v e‑mailech (objednávky, webináře). Alternativně `SITE_URL` v části e‑mail kódu. |
| `GEMINI_API_KEY_RAG` | Google Gemini v Edge (RAG, agent, kampaně, …). |

---

## `make-server-93a20b6f` — marketing, webináře, Mailchimp, e‑mail

| Proměnná | Účel |
|----------|------|
| `MAILCHIMP_API_KEY` | API klíč (formát `…-us19`). |
| `MAILCHIMP_AUDIENCE_NEWSLETTER` | ID audience pro uživatele **se** souhlasem newsletteru. |
| `MAILCHIMP_AUDIENCE_NO_NEWSLETTER` | ID audience **bez** newsletteru. |
| `MAILCHIMP_AUDIENCE_PRIMARY` | Volitelně — jeden list pro admin počty / CSV. |
| `MANDRILL_API_KEY` | Odesílání transakčních e‑mailů (potvrzení webináře, objednávky přes sdílený modul, …). |
| `WEBINAR_REMINDER_CRON_SECRET` | Ochrana cronu připomínek webináře. |
| `NINJABOT_RAG_API_KEY` / `RAG_EXTERNAL_API_KEY` | Ochrana endpointu `external/rag-query`. |
| `WEBFLOW_API_TOKEN` | Sync / obsah z Webflow (kde použito v `server/index.tsx`). |
| `PIPEDRIVE_API_TOKEN` | Pipedrive API. |
| `PIPEDRIVE_DEFAULT_STAGE_ID`, `PIPEDRIVE_DEFAULT_OWNER_ID`, … | Pipeline / deal logika. |
| `PIPEDRIVE_ESHOP_*` | E‑shop dealy v Pipedrivu (viz `.env.example`). |
| `PIPEDRIVE_PRODUCT_CODE_FIELD` | Volitelně jeden klíč (nebo tečková cesta) v KV produktu pro **kód** odpovídající poli *Product code* v Pipedrivu; řádky dealu se přidají přes `GET /api/v2/products/search` (`exact_match` na `code`). Bez nastavení se bere heuristika (`pipedriveProductCode`, metadata, `shoptetId`, `isbn`, …). **Řádky `bundle:`** se zatím do dealu nepřidávají (nutné rozvinutí z definice balíčku). |
| `PIPEDRIVE_SCHOOL_ORDER_*`, `PIPEDRIVE_ORG_*` | Školní poptávka z webu → deal v Pipedrivu (pipeline podle štítku customer u org; `PIPEDRIVE_SCHOOL_ORDER_FALLBACK_OWNER_ID` = user_id při chybějícím owner z CRM). |
| `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN` | Slack integrace. |
| `PUBLIC_SITE_URL` | Odkazy v e‑mailech webináře (`getPublicSiteOrigin()`). |
| `GOOGLE_MAPS_API_KEY` nebo `GOOGLE_PLACES_API_KEY` | **Našeptávání adres** v objednávce / pokladně (Google Places API přes Edge: `GET …/address-autocomplete`, `GET …/place-details`). Bez klíče pole fungují ručně. V Google Cloud zapnout Places API (legacy) a fakturaci; klíč jen v Edge Secrets. |

Objednávkové e‑maily (`_shared/order-email.ts`): `MANDRILL_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `PUBLIC_SITE_URL` / `SITE_URL`, `ORDER_TRACKING_HMAC_SECRET`. Pokud hlavní web (`PUBLIC_SITE_URL`) není React e‑shop (např. Webflow), doplňte **`PUBLIC_ESHOP_URL`** — plná adresa nasazení Vite aplikace (včetně cesty `/VIVIDBOOKS_WEB_ESHOP` u GitHub Pages), aby odkazy *Sledovat objednávku* a *Dokončit platbu* mířily na SPA, ne na 404 marketingového webu.

---

## Asistent — `make-server-954b19ad` (a duplicity v `VIVIDASISTANT/`)

| Proměnná | Účel |
|----------|------|
| `ASSISTANT_ALLOWLIST_OFF` | `true` / `1` — vypne kontrolu seznamu e‑mailů. |
| `ASSISTANT_ALLOWED_EMAILS` | Povolené účty. |
| `GOOGLE_MAPS_API_KEY` | Mapy (kde je route používá). |
| `FIRECRAWL_API_KEY` | Nástroje vyžadující Firecrawl. |
| `GEMINI_API_KEY` | Fallback vedle `GEMINI_API_KEY_RAG`. |

---

## E‑shop worker funkce (zkráceně)

| Proměnná | Kde typicky |
|----------|-------------|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `stripe-webhook`, `create-payment-intent`, `resume-checkout` |
| `BASECOM_API_TOKEN`, `BASECOM_ORDER_STATUS_ID`, `BASECOM_CUSTOM_SOURCE_ID`, `BASECOM_CANCELLED_ORDER_STATUS_ID`, `BASECOM_INVENTORY_FEED_URL` | Base.com, sklad, export |
| `IDOKLAD_CLIENT_ID`, `IDOKLAD_CLIENT_SECRET`, číselníky `IDOKLAD_*` | Faktury po platbě (`process-export-queue`) |
| `PIPEDRIVE_INBOUND_WEBHOOK_SECRET`, `PIPEDRIVE_INBOUND_PIPELINE_IDS`, … | `pipedrive-inbound-deal` |

Kompletní Stripe/Basecom/iDoklad tabulky: [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Diagnostika (webinář: „nic v Mailchimpu / nepřišel mail“)

1. **Neříkat automaticky „chybí secrets“** — v produkci mohou být nastavené roky; příčina může být **regrese v kódu**, **nenasazený deploy**, **chyba API** (Mailchimp/Mandrill), **konkrétní e‑mail** (už v audience, bounce), **špatné ID audience** pro kombinaci newsletter ano/ne.
2. V odpovědi `POST …/webinar-registrace` je pole **`sync`** (`mandrill`, `mailchimp`).
3. V KV u registrace jsou **`mailchimpSync`**, **`mandrillSync`** (a časová razítka) — v adminu badge a **tooltip s `detail`**.
4. Od novějších zápisů i **`integrationPipeline`** + **`integrationSummary`** (souhrn jako workflow u objednávky) — v adminu **Registrace webinářů** tlačítko **Workflow** u řádku.
5. **Supabase → Edge Functions → Logs** pro konkrétní request — jediný spolehlivý zdroj bez přístupu k dashboardu z IDE.

### Centrála alertů v adminu (`/admin/alerty`)

- Tabulka **`order_alerts`** — monitoring objednávek (Base.com, iDoklad, fronta, …).
- Tabulka **`app_incidents`** — incidenty mimo čistě e‑shop (např. neodeslaný Mandrill / selhání Mailchimpu u webináře). Zápis z Edge: `supabase/functions/_shared/site-incidents.ts` (`upsertSiteIncident`).
- API funkce **`admin-order-alerts`** vrací sjednocený seznam (`scope=all|orders|site`), potvrzování / vyřešení funguje pro obě tabulky podle UUID.

---

## Pro údržbu dokumentace

- Novou **serverovou** proměnnou doplň do **tabulek výše** a do [`.env.example`](../.env.example) (komentář), pokud dává smysl pro vývojáře.
- Novou **`VITE_`** proměnnou: tabulka výše + `.env.example` + případně [DEPLOYMENT.md](./DEPLOYMENT.md), pokud jde o GitHub Actions.
