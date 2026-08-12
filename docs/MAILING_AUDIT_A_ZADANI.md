# Mailing — audit současného stavu a zadání pro náhradu Mailchimpu

> Vzniklo z kompletního průzkumu kódu (admin UI, Edge funkce, migrace DB, Mailchimp integrace) — červenec 2026.
> Cíl: **úplně nahradit Mailchimp** vlastním mailingem v adminu (kampaně i automatizace typu „registrace trialu → sekvence e-mailů“).

---

## 1. Shrnutí (TL;DR)

Vlastní mailing je rozpracovaný zhruba **z poloviny** — a přesně v půlce je i architektonicky:

| Vrstva | Stav |
|--------|------|
| **Datový model v Postgresu** (subscribers, tags, campaigns, email_events, automation_flows…) | ✅ hotový, navržený přímo jako náhrada Mailchimpu („příprava na Resend“) |
| **Import z Mailchimpu** (kontakty, tagy, kampaně, aktivita) | ✅ funguje (Edge endpoint + CLI skript + admin `/admin/migrace`) |
| **Admin Audience** (`/mailing/audience`) | ✅ funguje nad Postgresem (filtry, tagy, zájmy, aktivita) |
| **EmailBuilder** (`/mailing/emaily`) | ✅ plnohodnotný blokový editor + AI, ALE… |
| **Odesílání kampaní** | ❌ **stále jde přes Mailchimp API** (create-draft → dokončení v MC UI) |
| **Automatizace** (`/mailing/automatizace`) | ❌ jen placeholder stránka, tabulky v DB prázdné, žádný engine |
| **Sběr kontaktů z webu do Postgresu** | ❌ žádný formulář nezapisuje do `subscribers` — vše jde do Mailchimpu nebo jen do KV |
| **Odhlašování, double opt-in, tracking (opens/clicks/bounces) live** | ❌ neexistuje (jen jednorázový import z MC) |

**Klíčový poznatek:** dnes neexistuje žádná cesta, jak z adminu poslat e-mail na celou audienci bez Mailchimpu. Transakční e-maily (objednávky, webináře, připomínky) už ale běží nezávisle přes **Mandrill** — takže odesílací know-how v projektu je.

---

## 2. Mapa současného stavu

### 2.1 Admin UI (co uživatel vidí)

| Stránka | Route | Stav | Poznámka |
|---------|-------|------|----------|
| **EmailBuilder** | `/mailing/emaily`, `/mailing/novy-email` | ✅ funkční | Drafty (KV), blokový editor, AI generování/přepis, náhled, test send (hardcoded allowlist 4 adres), push draftu do Mailchimpu. **Plánované odeslání se jen uloží na draft — do MC se nepropisuje.** Ostrý send z adminu neexistuje (endpoint `send-campaign` je na serveru, ale UI ho nevolá). |
| **Audience** | `/mailing/audience` | ✅ funkční | Postgres `subscribers`: stránkování, filtry (tagy OR, zájmy o předměty přes RPC, pozice), detail kontaktu (merge fields, listy, aktivita), správa tagů (+ volitelný sync zpět do MC), přepočet zájmů. Chybí fulltext hledání e-mailu a segment builder. |
| **Automatizace** | `/mailing/automatizace` | ❌ **placeholder** | Statická stránka „Sem připravíme automatizační flow, sekvence a triggry…“ |
| **Kontakty (legacy)** | `/marketing/kontakty` | ✅ funkční, ale duplicitní | Starší model: snapshot Mailchimp audience v tabulce `marketing_contacts_93a20b6f` (sync ~1×/24 h ručně). Má navíc hledání e-mailu a sloupec účasti na webinářích. Dva paralelní modely kontaktů = zmatek. |
| **Marketing Agent** | `/marketing/marketing-agent` | ✅ funkční | AI chat + generování e-mailu + push draftu do MC (jednodušší cesta než EmailBuilder). |
| **Migrace** | `/admin/migrace` | ✅ funkční | Dávkový import Mailchimp → Postgres (kontakty, tagy, listy, kampaně, volitelně aktivita ~180 dní). |
| **Marketing dashboard** | `/marketing` | ✅ | Jen rozcestník + počet MC kampaní. Žádné statistiky kampaní. |
| **Kalendář** | `/marketing/kalendar` | ⚠️ | Plánování eventů/sekvencí jen jako KV záznamy — bez napojení na odesílání. |

### 2.2 Backend

**Odesílací provideři:**
- **Mandrill** (Mailchimp Transactional) — ✅ všechny transakční e-maily: potvrzení webináře + .ics, připomínky webinářů (pg_cron á 10 min), follow-upy po webináři (ruční bulk), DVPP certifikáty, poděkování za newsletter, všechny objednávkové e-maily (`_shared/order-email.ts`: potvrzení, expedice, storno, upomínky platby, auto-storno).
- **Mailchimp Marketing API** — kampaně (create draft, test send, send), tagy členů, čtení audience.
- **Resend** — ❌ jen ve schématu (`campaigns.resend_broadcast_id`, event source `resend`), **v kódu není jediné volání**.

**Datový model (migrace `20260415140000_email_marketing_core.sql`):**
`lists`, `subscribers` (vč. trial polí, e-commerce polí, engagement_score), `tags` + `subscriber_tags`, `subscriber_lists`, `campaigns`, `email_links`, `email_events` (send/open/click/bounce/complaint/unsub s dedupe), `automation_flows` + `automation_enrollments` (**prázdné, žádný kód je nepoužívá**). RLS: čtení jen staff (`admin_staff_emails`), zápis service role.

**Endpointy (hlavní server `make-server-93a20b6f`):**
- ✅ `/admin/mailing/tags` (GET/POST), `/admin/mailing/subscribers/:id/tags`, `/admin/mailing/recompute-subject-interests`, `/admin/migrate-mailchimp-contacts`
- ✅ `/admin/mailchimp/*` — create-draft, send-test-email, send-campaign, generate-email, sync
- ✅ `/admin/email-drafts` (KV drafty editoru)
- ❌ chybí: CRUD kampaní nad Postgres tabulkou `campaigns`, odeslání kampaně vlastní cestou, CRUD subscriberů, veřejný unsubscribe, tracking endpointy (open pixel, click redirect), webhooky providera → `email_events`

### 2.3 Kudy dnes tečou kontakty (a kudy NE)

| Zdroj | Kam se zapisuje | Postgres `subscribers`? |
|-------|-----------------|--------------------------|
| Registrace na webinář | Mailchimp (audience dle souhlasu + tagy `webinar-{slug}`, `webinar-registrace`, `newsletter`) + KV | ❌ |
| DVPP video registrace | Mailchimp (tagy `dvpp-video…`) + Mandrill e-mail | ❌ |
| Aktivace trialu (`verify-token`) | Mailchimp tag `trial-active` | ❌ |
| **Trial formulář `/vyzkousejte`** | **legacy API `free-trial-ajax` mimo tento repozitář** (pravděpodobně tam vzniká tag `Trial form` → MC automatizace) | ❌ |
| Newsletter popup/banner (`/newsletter/subscribe`) | **jen KV** + Mandrill poděkování — do Mailchimpu se nepropisuje! | ❌ |
| E-shop checkout | nikam (žádný MC hook v repu) | ❌ |
| Mailchimp import (ruční) | → Postgres | ✅ jednorázově |

Tedy: **Postgres audience zastarává od chvíle importu** — nic ji průběžně neplní.

### 2.4 Co stále bezpodmínečně závisí na Mailchimpu

1. **Odeslání kampaně na audienci** (draft + send přes MC).
2. **Automatizace v MC UI** — tag-triggered journeys (trial, webinar, newsletter) — běží mimo repo, na tazích, které tam web posílá.
3. **Odhlašování** — pouze merge tag `*|UNSUB|*` v MC kampaních; vlastní e-maily mají jen `mailto:hello@`.
4. Webinar follow-upy čtou příjemce z MC tagů (send je ale Mandrill).
5. Segmenty a engagement historie.

---

## 3. Srovnání se základními funkcemi Mailchimpu

| Mailchimp funkce | Vlastní systém dnes | Chybí |
|------------------|---------------------|-------|
| **Audience / kontakty** | ✅ Postgres model + admin UI | průběžné plnění z formulářů, ruční přidání/editace/smazání kontaktu, import CSV, fulltext hledání |
| **Tagy** | ✅ CRUD + filtr | hromadné tagování (bulk), auto-tagy ze zdrojů |
| **Segmenty** | ⚠️ jen tagy + pozice + zájmy | uložené segmenty s podmínkami (AND/OR, engagement, trial stav, zákazník…), počty příjemců před odesláním |
| **Signup formuláře + double opt-in** | ⚠️ formuláře existují, ale zapisují do MC/KV | zápis do `subscribers`, double opt-in (dnes rovnou `subscribed`), potvrzovací e-mail |
| **Kampaně — tvorba** | ✅ EmailBuilder (lepší než MC editor: bloky + AI) | šablony/knihovna (jen drafty), A/B test |
| **Kampaně — odeslání** | ❌ jen přes MC | vlastní send engine (batch, throttling, retry), plánované odeslání, potvrzovací dialog s počtem příjemců |
| **Kampaně — reporting** | ❌ | opens/clicks/bounces per kampaň, dashboard, srovnání kampaní |
| **Automatizace / Customer Journeys** | ❌ (jen prázdné tabulky + placeholder) | trigger engine (event → enroll), kroky (wait/e-mail/podmínka/tag), editor flow, monitoring enrollmentů |
| **Transakční e-maily (Mandrill)** | ✅ plně funkční | — (jen sjednotit tracking do `email_events`) |
| **Unsubscribe / preference centrum** | ❌ | jednoklikový unsubscribe (RFC 8058 `List-Unsubscribe`), veřejná stránka, propis do `subscribers.status` |
| **Tracking (opens, clicks)** | ❌ live (jen import z MC) | open pixel, click redirect přes `email_links`, webhook providera → `email_events`, aktualizace `engagement_score` |
| **Bounce/complaint handling** | ❌ | webhook → status `cleaned`, potlačení dalšího odesílání |
| **Doručitelnost** | ⚠️ Mandrill domény nastavené | pro nový send engine: SPF/DKIM/DMARC pro marketing subdoménu, warm-up plán |
| **E-commerce data** | ⚠️ sloupce připravené (`is_customer`, `total_orders`) | plnění z objednávek |

---

## 4. Zadání — co dodělat (po fázích)

### Fáze 0 — Rozhodnutí a základy (blokuje vše ostatní)

- [ ] **Zvolit odesílacího providera pro marketing:** Resend (schéma je na něj připravené) vs. zůstat u Mandrillu (už nakonfigurovaný, ale je to Mailchimp produkt → při rušení MC účtu ověřit, že Mandrill přežije / raději Resend). Doporučení: **Resend** pro marketing, Mandrill nechat na transakci (nebo později také přesunout).
- [ ] Nastavit odesílací (sub)doménu: SPF, DKIM, DMARC, např. `news.vividbooks.com`; plán warm-upu.
- [ ] **Zabezpečit `/admin/mailing/*` a `/admin/mailchimp/*` endpointy** — dnes většina nemá `requireAdminJwt` (gateway `verify_jwt = false`). Před spuštěním vlastního sendu je to nutnost.
- [ ] Vyřešit dualitu kontaktů: prohlásit Postgres `subscribers` za jediný zdroj pravdy, `/marketing/kontakty` (KV snapshot) označit jako read-only legacy a naplánovat vypnutí. Doplnit do Audience fulltext hledání e-mailu + sloupec webinářové účasti (paritu s legacy stránkou).

### Fáze 1 — Sběr kontaktů do Postgresu (aby audience žila)

Všechny zápisy dělat **dual-write** (Postgres + Mailchimp) až do cutoveru, ať MC automatizace zatím běží dál:

- [ ] `POST /webinar-registrace` → upsert `subscribers` (source `webinar`, tagy `webinar-{slug}`, `webinar-registrace`, status dle souhlasu) + `subscriber_tags`.
- [ ] DVPP video registrace → totéž (source `webinar`, tagy `dvpp-video…`).
- [ ] Newsletter popup/banner (`/newsletter/subscribe`) → upsert `subscribers` (source `newsletter`) — dnes končí jen v KV!
- [ ] **Trial:** zjistit, co přesně dělá legacy `free-trial-ajax` (mimo repo) a přenést zápis do Edge: upsert `subscribers` (source `trial`, `trial_status`, `trial_started_at`, `trial_expires_at`) + tag. Aktivaci (`verify-token`) propsat jako `trial_status = active`.
- [ ] Checkout / objednávky → po zaplacení upsert `subscribers` (source `checkout`, `is_customer = true`, `total_orders++`, `first_purchase_at`).
- [ ] Ruční správa v adminu: přidat/upravit/smazat kontakt, import CSV.
- [ ] **Double opt-in** pro newsletter (status `pending` → potvrzovací e-mail → `subscribed`).

### Fáze 2 — Vlastní odesílání kampaní (jádro náhrady)

- [ ] **Send engine** (Edge funkce + fronta): kampaň z EmailBuilderu → výběr příjemců (tagy/segment, jen `subscribed`, minus bounces) → render HTML per příjemce (merge fieldy `{{first_name}}` apod.) → batch odeslání přes providera s rate limitem, retry, logem do `email_events` (`send`).
- [ ] Napojit EmailBuilder: místo „push do Mailchimpu“ → „Uložit kampaň“ (Postgres `campaigns`) + „Odeslat“ / „Naplánovat“ (využít existující `scheduledSendAt`, cron který plánované kampaně odešle).
- [ ] Potvrzovací krok s počtem příjemců + povinný test send.
- [ ] **Unsubscribe:** podepsaný token per příjemce, veřejný endpoint + stránka, hlavička `List-Unsubscribe` + `List-Unsubscribe-Post` (one-click), zápis do `subscribers.status` + `email_events`.
- [ ] **Tracking:** open pixel endpoint, click redirect přes `email_links`, webhook providera (delivered/bounce/complaint) → `email_events`; noční job aktualizuje `engagement_score`, `last_opened_at`, `last_clicked_at`.
- [ ] Test send: nahradit hardcoded allowlist (4 adresy v `EmailBuilder.tsx` a `index.tsx`) konfigurací / admin rolí.
- [ ] Reporting: stránka kampaně — sent/delivered/opens/clicks/bounces/unsubs, seznam kliknutých odkazů; přehled kampaní místo MC počtu na dashboardu.

### Fáze 3 — Automatizace (náhrada MC journeys)

Tabulky `automation_flows` + `automation_enrollments` už existují, chybí celý engine:

- [ ] **Definice flow** (JSONB `definition`): trigger (`subscriber.created` se source/tag filtrem, `tag.added`, `trial.activated`, `webinar.registered`, `order.paid`) + kroky (`send_email` s odkazem na šablonu z EmailBuilderu, `wait` X dní/hodin, `condition` — např. otevřel předchozí / má tag, `add_tag` / `remove_tag`, `exit`).
- [ ] **Enrollment:** eventy z Fáze 1 zapisují do `automation_enrollments`; cron (á 5–10 min) posouvá enrollmenty na další krok, odesílá přes send engine, respektuje unsubscribe.
- [ ] **Admin UI `/mailing/automatizace`** (nahradí placeholder): seznam flows (aktivní/pauza), editor kroků (stačí lineární sekvence, ne vizuální canvas), detail s enrollmenty a funnel statistikou.
- [ ] **První flows k replikaci z Mailchimpu** (nutno vyexportovat přesný obsah z MC UI — v repu nejsou):
  1. Trial welcome sekvence (registrace trialu → uvítací série)
  2. Trial expirace (X dní před koncem → nabídka)
  3. Webinar follow-up (nahradí ruční bulk send)
  4. Welcome newsletter

### Fáze 4 — Segmentace a komfort

- [ ] Uložené segmenty: builder podmínek (tagy AND/OR, contact_type, pozice, zájmy, trial stav, `is_customer`, engagement, poslední otevření) → tabulka `segments` + použití v kampani i automatizaci.
- [ ] Knihovna šablon (uložené bloky/celé e-maily mimo drafty).
- [ ] Bulk operace v Audience (tagování výběru, export CSV).
- [ ] Volitelně: A/B test subjectu.

### Fáze 5 — Cutover z Mailchimpu

- [ ] Finální doimport z MC (kontakty + aktivita) těsně před přepnutím.
- [ ] Vypnout dual-write do MC (webináře, DVPP, trial tagy).
- [ ] Přepnout automatizace: vypnout MC journeys, zapnout vlastní flows.
- [ ] Webinar follow-upy: příjemce brát z Postgresu místo MC tagů.
- [ ] Odstranit/deaktivovat MC endpointy a secrets (`MAILCHIMP_*`); pozor na Mandrill, pokud zůstává.
- [ ] Legacy `/marketing/kontakty` + KV snapshot vypnout.
- [ ] Aktualizovat `docs/PROJECT.md` (diagnostika „nic v Mailchimpu“ → nové postupy).

---

## 5. Otevřené otázky (nutno zjistit mimo repo)

1. **Co přesně dělá `free-trial-ajax`** (legacy API na api.vividbooks.com) — jaké tagy/merge fieldy posílá do MC a jaké automatizace na ně v MC navazují? Bez toho nelze trial flow věrně replikovat.
2. **Seznam aktivních journeys v Mailchimp UI** — potřeba export obsahu všech automatizačních e-mailů (texty, časování, podmínky).
3. **Zůstane Mandrill po zrušení Mailchimp účtu?** (Mandrill je placený add-on MC — ověřit vazbu účtů; případně plán přesunu transakce na Resend.)
4. Používá se v MC ještě něco, co web neposílá (ruční kampaně kolegů, landing pages, signup formy hostované v MC)?

---

## 6. Odhad náročnosti (hrubě)

| Fáze | Odhad |
|------|-------|
| 0 — základy + security | 2–4 dny |
| 1 — sběr kontaktů + double opt-in | 4–6 dní |
| 2 — send engine + unsubscribe + tracking + reporting | 8–12 dní |
| 3 — automatizační engine + UI + 4 flows | 8–12 dní |
| 4 — segmenty + komfort | 4–6 dní |
| 5 — cutover | 2–3 dny + observace |

Fáze 1 a 2 lze dělat paralelně; automatizace (3) dává smysl až po send enginu.
