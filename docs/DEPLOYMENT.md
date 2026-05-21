# Nasazení e‑shopu (GitHub Pages, Supabase, Stripe)

## GitHub Pages (tento repozitář)

Workflow: [.github/workflows/deploy-github-pages.yml](../.github/workflows/deploy-github-pages.yml).

1. **Settings → Pages:** zdroj **GitHub Actions**, branch `main`.
2. **Secrets pro build** (repo → **Settings → Secrets and variables → Actions** → **New repository secret**). Jméno musí být přesně podle sloupce — Vite je při `npm run build` v CI vloží do statického JS.

   | Secret | K čemu |
   |--------|--------|
   | `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Payment Element (`pk_live_…` / `pk_test_…`) — bez něj často chybí platba. |
   | `VITE_PACKETA_API_KEY` | **Povinné pro výběr výdejního místa Zásilkovny** (widget Packeta). Bez něj na pokladně u Z-Point uvidíte hlášku typu *„Chybí VITE_PACKETA_API_KEY…“*. API klíč pro widget vygenerujete v administraci Zásilkovny (Packeta) pro váš e‑shop. |
   | `VITE_TWITTER_SITE` | Volitelné — `og:twitter:site` (např. `vividbooks` bez `@`). |

   Po přidání nebo změně secretu je potřeba **znovu nasadit** (push na `main` nebo v Actions spustit workflow znovu).

3. **Lokální vývoj:** zkopíruj [.env.example](../.env.example) na `.env` a doplň stejné proměnné (`VITE_PACKETA_API_KEY=…`), jinak stejná chyba jako na GitHub Pages.

### Secrets jsou v GitHubu, ale na webu pořád „chybí VITE_…“

`VITE_*` se do aplikace dostanou jen **v okamžiku `npm run build` v Actions**. Samotné uložení secretu **starý build na Pages neaktualizuje**.

1. **Znovu spusťte workflow** po přidání nebo úpravě secretu: **Actions** → workflow **Deploy GitHub Pages** → **Run workflow** (nebo push na `main`). V logu kroku **Verify VITE secrets reach the runner** musí být zelená *notice*, že klíč je k dispozici; pokud je *error* „PRÁZDNÝ“, Actions secret v tom běhu opravdu nepřišel (špatný název, jiné repo / fork bez secretů).
2. **Settings → Pages → Build and deployment:** zdroj musí být **GitHub Actions**. Pokud je nastavené **Deploy from a branch** (např. `gh-pages`), nasazuje se obsah z větve **bez** proměnných z Actions — pak klíče v Secrets nemají na výsledek vliv.
3. V prohlížeči zkuste **tvrdé obnovení** nebo anonymní okno (cache starého `*.js`).

### Nasazení ze složky `/docs` na větvi `main`

Pokud v **Settings → Pages** máte **Deploy from a branch** a složku **`/docs`**, GitHub servíruje přímo soubory z repozitáře — **ne** artefakt z workflow „Deploy GitHub Actions“. Po změnách v `index.html`, `public/` (favicon, logo) nebo kódu je potřeba lokálně spustit **`npm run build:github-pages`**, zkontrolovat změny v `docs/` a **commitnout je**. Bez toho zůstane např. starý `docs/index.html` bez odkazu na ikonu záložky.

---

## Supabase (produkce)

Migrace a Edge funkce se **nenasadí samy** z GitHubu.

- Přihlášení: `supabase login`, link projektu: `supabase link --project-ref <REF>`.
- Migrace: `supabase db push` (nebo váš schválený postup na produkci).
  - Migrace `20260414120000_checkout_sessions_idempotency.sql` přidává `checkout_sessions.idempotency_key` — bez ní může `create-payment-intent` při paralelních požadavcích založit víc `pending_payment` objednávek se stejným košíkem.
- Funkce kritické pro platby a objednávky (minimální sada):
  - `create-payment-intent`
  - `stripe-webhook`
  - `get-order-by-payment-intent`
  - `resume-checkout`
  - `send-order-email`
  - `process-export-queue`
  - `make-server-93a20b6f` (produkty, školní `/orders`, …)

Příklad (jedna po druhé) nebo skript z kořene repa:

```bash
./scripts/supabase-deploy-eshop-functions.sh
```

Jednotlivě např.:

```bash
supabase functions deploy create-payment-intent --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy get-order-by-payment-intent --no-verify-jwt
supabase functions deploy resume-checkout --no-verify-jwt
```

U funkcí volaných jen se `Authorization: Bearer anon` z prohlížeče nastavte v Dashboardu **Supabase → Edge Functions → příslušná funkce → JWT** podle vaší politiky (`verify_jwt`).

### Secrets v Supabase (Edge Functions → Secrets)

Minimálně pro platby:

| Secret | K čemu |
|--------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_…` / `sk_test_…` — serverové funkce |
| `STRIPE_WEBHOOK_SECRET` | Podpis webhooku (viz níže) |
| `DATABASE_URL` nebo `SUPABASE_DB_URL` | Postgres pro zápis objednávek |
| `SUPABASE_URL` | Volání dalších funkcí z webhooku |
| `SUPABASE_ANON_KEY` | `create-payment-intent` / `submit-transfer-order` ověřují ceny proti katalogu (`/functions/v1/make-server-93a20b6f/products`). |
| `ORDER_TRACKING_HMAC_SECRET` | HMAC pro parametr `t` u sledování objednávky a u `get-order-by-payment-intent` — bez něj API nevrátí `trackingToken` v odpovědi create-payment-intent. |
| `ADMIN_ALLOWED_EMAILS` | E-maily oddělené čárkou — kdo smí volat Edge funkce `admin-orders`, `admin-order-action`, `admin-analytics`, … (kromě `ADMIN_ALLOWLIST_OFF=true`). |
| `SUPABASE_SERVICE_ROLE_KEY` (nebo anon pro interní volání dle kódu) | `stripe-webhook` volá `send-order-email`, `process-export-queue`, … |

Migrace `20260417210000_marketing_rls_admin_only.sql` omezuje čtení marketingových tabulek v DB na e-maily v `public.admin_staff_emails` (výchozí řádky odpovídají allowlistu v kódu). Další administrátory přidejte v SQL (`insert … on conflict do nothing`) nebo přes Dashboard.

Další proměnné podle zapnutých integrací (Basecom, iDoklad, e‑mail SMTP, …).

#### Base.com / BaseLinker

`process-export-queue` vytváří objednávky v Base.com přes `addOrder`. Cílová skupina/stav v levém menu Base.com se nastavuje parametrem `order_status_id`, který bere hodnotu ze Supabase secretu `BASECOM_ORDER_STATUS_ID`.

Aktuální Base.com stavy z `getOrderStatusList`:

| ID | Název |
|----|-------|
| `438571` | Nové objednávky (přenos do FF) |
| `438572` | Vytvořeno v FF |
| `438573` | Odesláno |
| `438574` | Zrušeno |
| `438575` | Čeká na zboží v FF |
| `441049` | Doručeno |
| `441050` | Problém v expedici FF |
| `441051` | Error FF (chyba přenosu) |
| `441052` | V expedici FF |
| `441053` | Zabaleno v FF |
| `441054` | Vrácena do FF |
| `444858` | Do expedice (manual) |

Pro nové objednávky, které mají čekat na přenos do FF, nastavte:

```bash
supabase secrets set BASECOM_ORDER_STATUS_ID=438571 --project-ref iekkundgizzdbmkzatdl
```

#### iDoklad ([API v3](https://api.idoklad.cz/Help/v3/cs/index.html))

Po úspěšné platbě kartou zařadí `stripe-webhook` úlohu `idoklad` do `export_queue` **pro každou zaplacenou objednávku** (bez ohledu na IČO). Stejně se faktura zařadí u inbound objednávek z Pipedrive (pokud není chybějící kontakt). Zpracuje ji funkce **`process-export-queue`** (OAuth **client credentials**, pak `POST https://api.idoklad.cz/v3/IssuedInvoices`). U objednávek ve stavu zaplaceno se do iDokladu posílá i **`DateOfPayment`** (den vystavení), aby byl doklad veden jako uhrazený; odeslání PDF e-mailem řeší pravidla v samotném iDokladu.

| Secret | K čemu |
|--------|--------|
| `IDOKLAD_CLIENT_ID` | OAuth Client ID z iDoklad (vývojářská aplikace). |
| `IDOKLAD_CLIENT_SECRET` | OAuth Client secret. |
| Scopes | V kódu je `scope=idoklad_api` (musí být u aplikace povolené). |

Volitelné číselné ID podle vašeho účtu iDoklad (když výchozí hodnoty neodpovídají číselníkům v administraci):

| Secret | Výchozí | Význam |
|--------|---------|--------|
| `IDOKLAD_NUMERIC_SEQUENCE_ID` | — | ID číselné řady vydaných faktur. Má přednost před názvem. |
| `IDOKLAD_NUMERIC_SEQUENCE_NAME` | — | Přesný **název** řady v iDokladu (např. `CZ PRINT B2C`), typ dokumentu vydaná faktura. Funkce načte ID přes `GET /v3/NumericSequences`. Pokud jsou vyplněné ID i jméno, použije se ID. |
| `IDOKLAD_COUNTRY_ID` | `2` | Země adresy partnera (ČR). |
| `IDOKLAD_PAYMENT_TYPE_ID` | `3` | Typ platby (např. karta). |
| `IDOKLAD_CURRENCY_ID` | `1` | Měna CZK. |
| `IDOKLAD_PRICE_TYPE_WITH_VAT` | `1` | Ceny včetně DPH. |
| `IDOKLAD_VAT_RATE_REDUCED` | `2` | Snížená sazba (sešity / knihy). |
| `IDOKLAD_VAT_RATE_STANDARD` | `1` | Základní sazba (např. doprava u převodu / bez Stripe). |
| `IDOKLAD_VAT_RATE_ZERO` | `2` | Sazba 0 % DPH (`VatRateType.Zero` v API) — **řádek dopravy u e‑shopu** (karta / Apple Pay / Google Pay nebo objednávka se `stripe_payment_intent_id`). |
| `IDOKLAD_SEND_INVOICE_EMAIL` | — | `true` / `1`: po `POST IssuedInvoices` a uhrazených i po `FullyPay` zavolat `POST …/IssuedInvoices/{id}/Send` (PDF e‑mailem z iDokladu na kontakt dokladu). |
| `IDOKLAD_SEND_INVOICE_SEND_AS` | `1` | Volitelně přepsat typ odeslání dle číselníku iDoklad (`SendAs` v těle Send). |

Nasazení: `supabase functions deploy process-export-queue --no-verify-jwt` (nebo celý skript v sekci výše). Frontu je potřeba pravidelně spouštět (cron / Supabase schedule), pokud ji už nemáte napojenou.

---

## Stripe — co nastavit v Dashboardu

### 1. Režim Test vs Live

- Pro ostrý web použij **Live** klíče (`pk_live_…`, `sk_live_…`).
- Testování: **Test** klíče a testovací karty z [Stripe docs](https://stripe.com/docs/testing).

### 2. Publishable key → frontend

- **Developers → API keys** zkopíruj **Publishable key** do:
  - GitHub Actions secret `VITE_STRIPE_PUBLISHABLE_KEY`, nebo
  - `.env` lokálně jako `VITE_STRIPE_PUBLISHABLE_KEY`.

### 3. Secret key → Supabase

- **Secret key** (`sk_…`) ulož jen do **Supabase Secrets** jako `STRIPE_SECRET_KEY` (nikdy do frontendu ani do veřejného repa).

### 4. Webhook (nezbytné pro zaplacení objednávky)

1. **Developers → Webhooks → Add endpoint**
2. **Endpoint URL** (produkční Supabase):

   `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`

3. **Události k odeslání** — pro tento projekt stačí:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

4. Po vytvoření endpointu zkopíruj **Signing secret** (`whsec_…`) do Supabase Secret **`STRIPE_WEBHOOK_SECRET`**.

5. Znovu **deploy** funkce `stripe-webhook` po změně secrets.

### 5. Payment Element / metody

- V **Settings → Payment methods** zapni potřebné metody (karty; Apple Pay / Google Pay podle domény a pravidel Stripe).
- Pro Apple Pay často **Settings → Payment methods → Apple Pay → přidat doménu** ověřenou souborem na hostingu.

### 6. Kontrola po nasazení

- Testovací nákup → po zaplacení musí webhook vrátit **200** (Supabase → Edge Functions → Logs).
- V Stripe → **Developers → Webhooks** u endpointu zkontroluj **Recent deliveries** (úspěch / chyba).
- Stránka poděkování čte objednávku přes `get-order-by-payment-intent` — musí být nasazená stejná verze jako v repu.

### 7. Časté problémy

| Jev | Možná příčina |
|-----|----------------|
| Platba proběhne, objednávka zůstane „čeká“ | Webhook neexistuje, špatná URL, špatný `STRIPE_WEBHOOK_SECRET`, funkce nenasazená |
| „Missing Stripe…“ v odpovědi API | Chybí `STRIPE_SECRET_KEY` v Supabase |
| Frontend bez formuláře platby | Chybí `VITE_STRIPE_PUBLISHABLE_KEY` v buildu |
| „Chybí VITE_PACKETA_API_KEY…“ na pokladně (Doprava) | V CI / lokálně chybí proměnná při buildu: nastav GitHub Actions secret `VITE_PACKETA_API_KEY` a znovu deployni, nebo `.env` lokálně |
| 400 na webhooku | Špatný podpis → zkontroluj `whsec` a že URL míří na správný projekt |

---

## OG obrázky (náhledy odkazů)

Po změně šablon spusť lokálně:

```bash
npm run og-assets
```

Commitni vygenerované soubory v `public/og/` a `public/og-image.png`.
