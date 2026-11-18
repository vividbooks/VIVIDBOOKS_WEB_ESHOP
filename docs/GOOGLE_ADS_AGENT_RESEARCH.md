# Google Ads agent — research & plan (draft for Monday call)

**Datum:** 5. 11. 2026 (průzkum proti větvím `main` obou repozitářů)
**Repozitáře:** `VIVIDBOOKS_WEB_ESHOP` (marketing / e-shop) + `vividbooks-ultra` (aplikace / licence / usage)
**Stav:** research, žádný kód změněn.

---

## 1. Co šéf pravděpodobně chce (3 interpretace)

1. **A) „Propojit dva repozitáře.“** Dnes jsou dva Supabase projekty (`iekkundgizzdbmkzatdl` web, `qypiuvqglsmxdsnyazih` ultra) s ručně lepenými kontrakty (identity upsert, eshop catalog, public identity-activity). Cíl: jeden strojově čitelný datový kontrakt, aby marketing mohl spočítat skutečnou hodnotu zákazníka (ne jen kliky).
2. **B) „Automatický agent pro Google Ads.“** Denní agent, který navrhuje/opravuje reklamy a kampaně, ale **ne** bez schválení — stávající `googleAdsGrowth.ts` už umí denní research + schvalovací push + enable s tvrdým strope 1 000 Kč/den.
3. **C) „Měřit všechno.“** Uzavřít smyčku: reklama → návštěva → lead → trial → licence → používání → objednávka → obnova, s hodnotami konverzí zpět do Google Ads (offline conversions).

**Doporučení:** A+B+C dohromady, ale fázovaně. „Měřit všechno“ je nerealistické; měřit **rozhodující** události (nákup, trial, aktivace, platba licence) a posílat je zpět do Google Ads jako konverze s hodnotou.

---

## 2. Co už existuje (inventář)

### 2.1 E-shop / marketing (`VIVIDBOOKS_WEB_ESHOP`)

| Oblast | Stav | Soubory / tabulky |
|---|---|---|
| Google Ads API klient (OAuth refresh, mutate, keyword ideas, RSA) | ✅ hotovo | `src/supabase/functions/server/googleAdsGrowth.ts` (default API v25) |
| Denní research cron (05:30 UTC) | ✅ hotovo | migrace `20261102120000_google_ads_growth_cron.sql`, endpoint `/cron/google-ads-growth` |
| Admin UI (návrhy, budget, push, enable) | ✅ hotovo | `src/components/admin/GoogleAdsGrowthPage.tsx`, route `/marketing/google-ads` |
| Guardrails (strop 1 000 Kč/den, schválení, kampaň vzniká pozastavená) | ✅ hotovo | `GADS_HARD_MAX_DAILY_CZK`, `ensureCampaign`, `pushDraft` |
| GTM + Consent Mode v2 | ✅ hotovo | `index.html`, `src/lib/googleConsentMode.ts`, `src/lib/googleConsentSignals.ts` |
| dataLayer e-commerce události | ✅ hotovo | `src/utils/dataLayerEcommerce.ts` (view_content, add_to_cart, begin_checkout, purchase, …) |
| Identity graf (osoba ≠ e-mail, orgs, memberships, web_events) | ✅ hotovo | migrace `20260813200000_identity_graph.sql`, endpointy `/identity/upsert`, `/identity/web-event` |
| DVPP funnel (funnel_events + Meta CAPI + GA4 MP) | ✅ hotovo | `supabase/functions/server/dvpp/events.ts`, migrace `20260905100000_dvpp_lead_magnet_core.sql` |
| Growth Agent (Meta + Google kreativy, review) | 🟡 rozpracováno | `docs/growth-agent.md`, `src/components/admin/GrowthAgentPage.tsx` |
| Orders / checkout / Stripe / Basecom / iDoklad | ✅ hotovo | `docs/PROJECT.md`, edge funkce `create-payment-intent`, `stripe-webhook`, … |
| Pipedrive sync (eshop deals, won webhook) | ✅ hotovo | `pipedrive-inbound-deal`, `syncEshopOrderToPipedriveFromDb` |

### 2.2 Aplikace / licence (`vividbooks-ultra`)

| Oblast | Stav | Soubory / tabulky |
|---|---|---|
| Registr škol a licencí (IČO, období, Pipedrive, Custify) | ✅ hotovo | `supabase/functions/api/routes/registr.ts`, tabulky `registr_*`, pohledy `v_registr_*` |
| Customer Success aktivita (denní agregáty) | ✅ hotovo | `cs_activity_log`, migrace `20260810064512_customer_success_foundation.sql` (akce: app_opened, library_lesson_opened, lesson_presented, worksheet_printed, …) |
| Entitlementy (Vividboard, kvóta materiálů) | ✅ hotovo | `user_product_entitlements`, `user_material_quota`, `context/user-entitlements.ts` |
| Identity sync web ↔ ultra | ✅ hotovo | `context/web-identity-sync.ts`, `web-identity-activity.ts`, endpoint `/api/public/identity-activity`, `/api/public/teacher-code-handoff/identity-sync` |
| Eshop katalog v ultra (URL sešitů) | ✅ hotovo | `supabase/functions/_shared/eshop-catalog.ts` |
| AI chat / RAG / Curriculum Factory | ✅ hotovo | `ai.ts`, `platform-rag-search.ts`, … (může generovat copy/insights) |
| Google Ads | ❌ není | — |

### 2.3 Naměřený baseline (produkce, 5. 11. 2026)

**Ultra (`qypiuvqglsmxdsnyazih`):**
- `profiles` 7 324, `platform_organizations` 1 765, `user_product_entitlements` 1 938, `individual_license_device_seats` 373
- `cs_activity_log`: 327 601 řádků, 1 485 org kódů, od 10. 8. 2026
  - 30d: `library_lesson_opened` 87 236, `library_opened` 113 797, `app_opened` 20 745, `worksheet_printed` 5 473, `lesson_presented` 506
- Registr: 16 474 org, 47 953 lidí, 25 013 licencí, 8 008 workbook objednávek, 443 trial requestů, 18 713 Pipedrive dealů, 13 006 školních kódů
- Aktivní licence dnes: 3 387 licencí / 1 865 org (z toho 10 544 org má někdy trial, 2 379 org placenou licenci)
- Kódy použité za 30 dní: 1 101, z toho 1 039 patří org s aktivní licencí (≈ 94 %)
- Workbook objednávky: říjen 2026 249 řádků / 1 051 ks / 91 147,50 Kč; srpen 2026 1 102 řádků / 21 654 ks / 2 173 367,50 Kč (školní objednávky přes Pipedrive)
- Trial requesty: z 443 jich 115 vzniklo, 326 bylo zamítnuto, 2 selhaly

**E-shop:** objednávky v `orders` (499 k 13. 8. 2026 dle identity auditu), identity graf 29 972 subscribers.

---

## 3. Mezery (gap analysis)

### 3.1 Atribuce kliku → konverze (největší díra)
- GTM/GA4 už pushuje e-commerce události, ale **žádný kód neukládá `gclid`/`gbraid`/`wbraid`/UTM** do first-party úložiště (docs/IDENTITY_A_MERENI.md: „Žádný Meta Pixel, žádná Conversions API, žádné UTM ukládání“).
- Bez click ID nelze přiřadit offline konverzi (trial/licence) ke kampani, kromě enhanced conversions přes hashovaný e-mail.
- **Akce:** zachytit click ID + UTM při příchodu, uložit do cookie/localStorage + `marketing_touchpoints` (eshop), přenést do checkout/trial/identity upsert.

### 3.2 Konverzní tracking (web + server-side + offline)
- Web: GA4/GTM e-commerce purchase existuje, ale chybí server-side potvrzení (Measurement Protocol jen pro DVPP).
- Offline: trial request → licence → objednávka sešitů → aktivace. Žádné z toho se neposílá do Google Ads.
- Od 15. 6. 2026 **musí** jít offline konverze přes **Data Manager API** (legacy `UploadClickConversions` je blokovaný pro tokeny bez předchozí aktivity). Viz §5.

### 3.3 Datový kontrakt mezi projekty
- Ultra → web: identity upsert (e-mail, app user, org, IČO, slot, subjects) — hotovo.
- Ultra → web: `identity-activity` (poslední den v app, worksheet_printed) — hotovo, ale čte se jen na požádání.
- Web → ultra: eshop katalog — hotovo.
- Chybí: web → ultra attribution (která kampaň přivedla trial/licenci), a ultra → web denní agregáty (usage, licence, objednávky sešitů) pro marketing dashboard.
- **Doporučení:** přidat read-only endpoint v ultra `GET /api/public/marketing/snapshot` (secret), který vrací denní agregáty per org/person (licence status, trial, usage, workbook orders, Pipedrive deal value). Eshop ho volá v denním cronu a ukládá do `growth_metrics_daily` / `growth_funnel_daily`.

### 3.4 Metriky a reporting
- Stávající Google Ads modul ukládá návrhy a metriky klíčových slov do KV (`gads:*`). Pro reporting a join s first-party daty je potřeba Postgres tabulky (`growth_*`), ne KV.
- Eshop má `admin-analytics`, ale ne spojení s Google Ads náklady.

### 3.5 Agent loop
- Dnes: denní research (keyword ideas) + ruční schvalování + push + enable. Chybí: pull výkonu z Google Ads, diagnostika, návrhy změn (negativní klíčová slova, pauza, budget), A/B, zpětná vazba.
- Chybí: audit log změn, kill switch, limity rychlosti změn, rollback.

### 3.6 Přístupy a credentials (Google Ads 2026)
- Developer tokeny byly zrušeny 9. 9. 2026; přístupová úroveň se váže na Google Cloud projekt (Explorer 2 880 ops/den, Basic 15 000, Standard neomezeně).
- **Keyword Planner (`generateKeywordIdeas`) je v Exploreru zakázaný** — stávající kód ho volá, takže bez Basic access denní běh selže na keyword ideas.
- Brand verification je nově povinná pro Basic/Standard.
- Multi-party approval (MPA) se týká **jen správy uživatelů**, ne kampaní — API uživatelé jsou z MPA vyňati. Tedy kampaňové mutace nejsou MPA-gated, ale odpovědnost za guardrails je na nás.

### 3.7 Právo a souhlas
- Consent Mode v2 je nastavený, ale offline upload hashovaných e-mailů (enhanced conversions for leads) vyžaduje: customer data terms v Google Ads, souhlas uživatele pro marketing, a správné hashování/normalizaci.
- GDPR: hashed e-mail je pseudonymizovaný osobní údaj; potřeba právní základ, informace v zásadách ochrany osobních údajů, DPA s Google.

---

## 4. Navrhovaná architektura

### 4.1 Princip
E-shop zůstává **marketingovým uzlem** (má Google Ads klienta, GTM, GA4, objednávky, identity graf). Ultra zůstává **produktovým uzlem** (licence, usage, Pipedrive, Custify). Propojení = **read-only API + denní ETL**, ne sloučení databází (soulad s `docs/IDENTITY_A_MERENI.md`: „Dva projekty zůstanou dva“).

```
Google Ads API (read + mutate, approved only)
        ▲
        │  daily ETL + proposals
        │
E-shop Supabase (iekkundgizzdbmkzatdl)  ◄── read-only snapshot ──  Ultra Supabase (qypiuvqglsmxdsnyazih)
  ├─ orders, checkout, identity_*                                      ├─ registr_* (licence, org, people)
  ├─ growth_* (metrics, proposals, audit)                               ├─ cs_activity_log (usage)
  ├─ marketing_touchpoints (click IDs)                                   ├─ user_product_entitlements
  ├─ Google Ads client (Edge fn make-server-93a20b6f)                    └─ /api/public/marketing/snapshot (secret)
  └─ admin UI (/marketing/google-ads, /marketing/growth-agent)
```

### 4.2 Datový model (eshop Postgres, nové tabulky)

- `marketing_touchpoints` — `id, anon_id (vb_id), gclid, gbraid, wbraid, utm_source/medium/campaign/content/term, landing_url, referrer, consent_analytics, consent_marketing, created_at, person_id, order_id`
- `marketing_leads` — `id, email, person_id, source (trial/webinar/contact), gclid, created_at, status`
- `growth_metrics_daily` — `date, platform, account_id, campaign_id, ad_group_id, keyword_id, impressions, clicks, cost_micros, conversions, conversion_value, currency`
- `growth_search_terms_daily` — `date, campaign_id, ad_group_id, search_term, match_type, impressions, clicks, cost_micros, conversions`
- `growth_proposals` — `id, type, entity_type, entity_id, current_value, proposed_value, evidence jsonb, expected_impact jsonb, status (draft/approved/rejected/applied/failed), approved_by, applied_at, result jsonb, created_at`
- `growth_runs` — `id, at, mode, summary jsonb, error`
- `growth_audit_log` — `id, at, actor, action, entity, before, after, result`

### 4.3 Nové endpointy

**Ultra (read-only, secret):**
- `POST /api/public/marketing/snapshot` — denní agregáty (orgs s aktivní licencí, trialy, usage 30d, workbook orders, Pipedrive deal value). Auth: `X-Marketing-Secret` / service token.
- (existuje) `/api/public/identity-activity` — per person/org usage.

**E-shop (Edge fn `make-server-93a20b6f`):**
- `POST /cron/marketing-snapshot` — zavolá Ultra snapshot + uloží do `growth_*`.
- `GET /admin/growth/state` — rozšířený (metrics + proposals + funnel).
- `POST /admin/growth/proposals/:id/approve|reject|apply` — apply volá Google Ads API mutate s `validate_only` dry run, pak potvrzení.
- `POST /cron/growth-optimize` — denní generování návrhů (pravidla + LLM).

### 4.4 Agent loop (deterministický, ne „LLM rozhoduje“)

1. **Observe** (denní cron): pull Google Ads metrics (GAQL) + first-party funnel + Ultra snapshot.
2. **Diagnose** (pravidla, LLM jen pro vysvětlení): CAC, ROAS, trial→paid, aktivace, anomálie (spend bez konverzí, vysoké CPC, nízké CTR, plýtvání na search terms).
3. **Propose** (strukturované návrhy s důkazy a očekávaným dopadem): přidat negativní klíčové slovo, pauznout keyword/ad group, změnit budget/bid, nová RSA, nový ad group.
4. **Approve** (admin UI, human-in-the-loop): guardrails (strop budgetu, žádné mazání, žádná nová kampaň bez schválení, rychlostní limity).
5. **Execute** (Google Ads API mutate, `validate_only` → potvrzení, audit log, kill switch).
6. **Measure** (přiřazení výsledku k návrhu, before/after, týdenní report).

**Důležité:** oficiální Google Ads MCP je **read-only** (3 nástroje). Pro zápisy je nutné Google Ads API mutate (nebo third-party write-capable server). „Agent“ = LLM vrstva pro reasoning + deterministický kód pro mutace. Nechat LLM volat mutace přímo je rizikové.

### 4.5 Fáze a odhad

| Fáze | Obsah | Odhad |
|---|---|---|
| 0 | Přístupy a audit (Google Ads účet, GA4, GTM, consent, conversion actions; data audit) | 1–2 dny |
| 1 | Click ID/UTM capture + server-side konverze (purchase, trial request) + validace GA4/Ads | 1–2 týdny |
| 2 | Metrics ETL + cross-system funnel + atribuce; proposal engine (pravidla); approval UI; audit | 2–3 týdny |
| 3 | Automated execution (mutates) s guardrails; experimentace; offline conversions přes Data Manager; optimalizační smyčka | 2–4 týdny |
| 4 | Kontinuální zlepšování (LTV model, Customer Match, PMax assety) | průběžně |

---

## 5. Google Ads 2026 — technické poznámky (ověřeno)

- **API verze:** aktuální v26.1 (28. 10. 2026), stávající kód používá v25 (podporováno do 8/2027). Doporučit upgrade.
- **Developer tokeny:** zrušeny 9. 9. 2026; přístupová úroveň se váže na Google Cloud projekt. Header je volitelný a ignorovaný. Existující kód funguje beze změn, ale brand verification je nově povinná pro Basic/Standard.
- **Přístupové úrovně:** Explorer 2 880 ops/den (bez Keyword Planneru), Basic 15 000, Standard neomezeně. Stávající `generateKeywordIdeas` vyžaduje Basic.
- **Offline konverze:** od 15. 6. 2026 musí jít přes **Data Manager API** (`events.ingest` s `userData` hashovaný e-mail/telefon + `gclid`/`gbraid`/`wbraid`). Legacy `UploadClickConversions` je blokovaný pro tokeny bez předchozí aktivity. Enhanced conversions for leads vyžaduje customer data terms + souhlas.
- **Oficiální Google Ads MCP:** read-only (3 nástroje: list_accessible_customers, search, get_resource_metadata). Pro zápisy nutné API mutate.
- **Multi-party approval:** jen správa uživatelů; API uživatelé jsou vyňati. Kampaňové mutace nejsou MPA-gated.
- **Consent Mode v2:** povinný v EEA (ČR). Marketingový souhlas už v UI existuje.

---

## 6. Otázky pro pondělní hovor (rozhodnutí)

1. **Cíl a KPI:** více e-shop objednávek (B2C sešity), více školních trialů/licencí (B2B), nebo obojí? Cílové CAC/ROAS?
2. **Google Ads účet:** který účet/MCC, měna CZK, kdo má přístup, jaké kampaně/konverze/GA4/GTM už běží, budget?
3. **Autonomie:** smí agent měnit budgety/bidy/pauzovat reklamy bez schválení? Tvrdý strop? Kdo schvaluje?
4. **Offline konverze:** smíme nahrávat hashované e-maily/hodnoty z CRM/registrů? Právní postoj ke GDPR?
5. **Systémy:** který systém je SoR pro objednávky, licence, usage, Pipedrive? Dostaneme read přístup k produkčním DB obou projektů?
6. **Rozsah pro pondělí:** jen research + plán, nebo i demo (read-only pull Google Ads + join s Ultra)?
7. **Kreativa a claims:** kdo schvaluje texty, jaká tvrzení jsou povolená (nepřehánět výsledky), cílová skupina (učitelé, ne děti).
8. **Nástroje:** používají Google Ads skripty, Smart Bidding, PMax? Je zapojená agentura? Kdo vlastní účet?
9. **Kvalita dat:** jsou GA4/GTM události validované? Nejsou konverze zdvojené? Server-side tagging?
10. **Cadence:** týdenní review, měsíční budget planning, alerting (Slack/e-mail)?

---

## 7. Rizika a non-goals

- **Rizika:** GDPR/souhlas, kvalita dat (legacy licence, IČO), API kvóty/přístup, atribuční slepé uličky (consent denied, iOS), přeautomatizace (plýtvání budgetem, pozastavení účtu), verze API.
- **Non-goals (zatím):** vlastní targeting/bidding optimizer, multi-touch attribution, autonomní změny budgetu bez schválení, mazání kampaní, plně autonomní publikace kreativ bez review.

---

## 8. Doporučený výstup pro pondělí

Nejvyšší hodnota za nejméně práce:
1. **Research memo** (tento dokument) + rozhodovací otázky.
2. **Access checklist** (Google Ads účet, GA4 property, GTM container, consent, API access level, brand verification, customer data terms).
3. **Data audit** (co měříme, co chybí, kontrakt mezi projekty).
4. Volitelně: **read-only spike** — denní pull Google Ads metrics do tabulky + join s Ultra usage/licencemi, zobrazení funnelu v adminu. (2–3 dny práce po schválení přístupů.)

---

## 9. Příloha — relevantní soubory

**E-shop:**
- `src/supabase/functions/server/googleAdsGrowth.ts` — Google Ads klient + denní research + push/enable
- `src/supabase/functions/server/index.tsx` (ř. 28099) — registrace routes
- `src/components/admin/GoogleAdsGrowthPage.tsx` — admin UI
- `src/routes.ts` (ř. 302, 330) — `/marketing`, `/marketing/google-ads`
- `src/utils/dataLayerEcommerce.ts` — e-commerce dataLayer
- `src/lib/googleConsentMode.ts`, `googleConsentSignals.ts` — consent
- `docs/IDENTITY_A_MERENI.md` — identity graf a měření
- `docs/growth-agent.md` — Growth Agent spec
- `supabase/migrations/20261102120000_google_ads_growth_cron.sql` — cron

**Ultra:**
- `supabase/functions/api/routes/registr.ts` — registr škol/licencí, hooky (web, pipedrive, custify, legacy)
- `supabase/functions/api/routes/public.ts` (ř. 722, 764, 812) — cs-activity, identity-sync, identity-activity
- `supabase/functions/api/context/web-identity-sync.ts`, `web-identity-activity.ts` — sync
- `supabase/functions/_shared/eshop-catalog.ts` — eshop katalog v ultra
- `.claude/skills/vividbooks-mapa/reference/05-licence-a-skoly.md`, `08-datovy-model.md`

**Měřené tabulky (Ultra prod):** `profiles`, `platform_organizations`, `user_product_entitlements`, `cs_activity_log`, `registr_organizations`, `registr_people`, `registr_licenses`, `registr_trial_requests`, `registr_workbook_orders`, `registr_school_codes`, `registr_pipedrive_deals`, `registr_memberships`.
