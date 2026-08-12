# Implementační prompt — vlastní mailing (náhrada Mailchimpu)

> Prompt pro agenta / vývojáře. Vychází z auditu `docs/MAILING_AUDIT_A_ZADANI.md` (červenec 2026).
> Provádí se po fázích — každá fáze je samostatně spustitelný celek s akceptačními kritérii.

---

## KONTEXT (přečti si před začátkem)

Projekt: `Web vividbooks` — React (Vite) + Supabase (Postgres, Edge Functions).

- Hlavní Edge server: `src/supabase/functions/server/index.tsx` (deploy jako `make-server-93a20b6f`, ~23k řádků, Hono router).
- Datový model mailingu už existuje: migrace `supabase/migrations/20260415140000_email_marketing_core.sql` — tabulky `lists`, `subscribers`, `tags`, `subscriber_tags`, `subscriber_lists`, `campaigns`, `email_links`, `email_events`, `automation_flows`, `automation_enrollments`. RLS: čtení jen staff (`admin_staff_emails`), zápis service role.
- Admin UI: `src/components/admin/EmailBuilder.tsx` (blokový editor, drafty v KV přes `/admin/email-drafts`), `MailingAudiencePage.tsx` (Postgres audience), `MailingPlaceholderPage.tsx` (placeholder automatizací na `/mailing/automatizace`), routy v `src/routes.ts`, sidebar v `AdminLayout.tsx`.
- Odesílání dnes: kampaně přes Mailchimp API (`/admin/mailchimp/create-draft`, `send-campaign`), transakce přes Mandrill (vzor: `supabase/functions/_shared/order-email.ts`, webinar e-maily v `index.tsx`).
- Import z Mailchimpu: `src/supabase/functions/server/mailchimpContactsMigrate.ts` + `scripts/mailchimp-export.ts` + admin `/admin/migrace`.
- Tagy: `src/supabase/functions/server/mailingTagsAdmin.ts` (s volitelným sync zpět do MC).
- Cron vzor: `supabase/migrations/20260617120000_schedule_webinar_reminder_cron.sql` (pg_cron → Edge endpoint se secretem).

## CÍL

Úplně nahradit Mailchimp: vlastní odesílání kampaní z adminu, automatizace (trial, webinar, newsletter), sběr kontaktů do Postgresu, unsubscribe a tracking. Mailchimp po cutoveru vypnout.

## ZÁVAZNÁ ROZHODNUTÍ

1. **Provider pro marketingové e-maily: Resend** (schéma je na něj připravené — `campaigns.resend_broadcast_id`, event source `resend`). Mandrill zůstává na transakčních e-mailech beze změny.
2. **Zdroj pravdy kontaktů: Postgres `public.subscribers`.** KV snapshot (`marketing_contacts_93a20b6f`) je legacy, nerozšiřovat.
3. **Dual-write až do cutoveru:** všechny formuláře zapisují do Postgresu I do Mailchimpu (stávající MC volání nechat, jen přidat Postgres upsert). MC automatizace musí běžet dál, dokud nejsou vlastní flows.
4. **Neblokující integrace:** zápis do `subscribers` nesmí shodit registraci (stejný pattern jako dnešní MC volání — try/catch + log, případně incident přes `upsertSiteIncident`).
5. Merge fieldy / personalizace: `{{first_name}}`, `{{last_name}}`, `{{school_name}}` (+ fallbacky, např. `{{first_name|učiteli}}`).
6. Styl kódu: česky komentáře/UI texty jako ve zbytku repa; Edge endpointy do stávajícího Hono serveru; nové tabulky přes SQL migrace v `supabase/migrations/` (idempotentní, `IF NOT EXISTS`, jako existující).

---

## FÁZE 0 — Základy a bezpečnost

**Úkoly:**

1. Zaveď `RESEND_API_KEY` do Edge secrets (+ `.env.example` + `docs/PROJECT.md` tabulka proměnných). Odesílací doména: `news.vividbooks.com` (SPF/DKIM/DMARC se nastavuje v Resend dashboardu — do docs napiš checklist, samotné DNS je mimo kód).
2. Sdílený modul `src/supabase/functions/server/resendClient.ts`: odeslání jednoho e-mailu (from, to, subject, html, headers, tags/metadata), retry na 429/5xx, rate limiting (Resend limit ~2 rps na free/základním tieru — konfigurovatelně).
3. **Zabezpeč admin mailing endpointy:** všechny `/admin/mailing/*`, `/admin/mailchimp/*`, `/admin/email-drafts*`, `/admin/migrate-mailchimp-contacts` musí vyžadovat admin JWT (použij existující `requireAdminJwt` z `index.tsx`; ověř, že admin UI posílá access token — dnes někde posílá jen anon key). Nerozbij veřejné endpointy (`/newsletter/subscribe`, `/webinar-registrace`…).
4. Do `MailingAudiencePage` doplň fulltext hledání podle e-mailu (ILIKE na `subscribers.email`, debounce).

**Akceptace:** admin endpointy vrací 401 bez platného admin JWT; UI funguje dál; test e-mail přes Resend klienta odejde (dočasný admin endpoint `/admin/mailing/resend-test` na allowlist adresy).

---

## FÁZE 1 — Sběr kontaktů do Postgresu

**Úkoly:**

1. Sdílená funkce `upsertSubscriber()` (nový modul `src/supabase/functions/server/subscribersUpsert.ts`): upsert podle `lower(trim(email))`, doplní jméno/telefon/školu jen pokud chybí, nastaví `source` jen při insertu, přidá tagy (vytvoří chybějící v `tags` se `source: 'system'`), respektuje `status` (nikdy nepřepisovat `unsubscribed` → `subscribed` bez explicitního resubscribe).
2. Napoj na existující endpointy (dual-write, neblokující):
   - `POST /webinar-registrace` → source `webinar`, tagy `webinar-{slug}`, `webinar-registrace`, status dle souhlasu newsletteru
   - `POST /dvpp-video-registrace` → source `webinar`, tagy `dvpp-video`, `dvpp-video-{slug}`
   - `POST /newsletter/subscribe` (popup/banner/footer) → source `newsletter` — dnes zapisuje JEN do KV!
   - `GET /verify-token/:token` (aktivace trialu) → `trial_status='active'`, `trial_started_at`, tag `trial-active`
   - Stripe úspěšná platba (místo kde se volá `send-order-email` s `order_confirmed`) → source `checkout`, `is_customer=true`, `total_orders+1`, `first_purchase_at`
3. **Double opt-in pro newsletter:** nový subscriber ze zdroje `newsletter` dostane status `pending` + potvrzovací e-mail (Resend) s podepsaným odkazem `GET /newsletter/confirm?token=…` → status `subscribed`, `subscribed_at`. Token: HMAC (secret `MAILING_TOKEN_SECRET`) z e-mailu + expirace 7 dní. Webinar/trial/checkout zůstávají single opt-in (mají GDPR checkbox).
4. Admin: v `MailingAudiencePage` přidej „Přidat kontakt“ (dialog: e-mail, jméno, typ, tagy) a „Import CSV“ (e-mail, jméno, příjmení, tagy; přes nový endpoint `POST /admin/mailing/subscribers/import`).

**Akceptace:** registrace webináře / newsletter signup / aktivace trialu / zaplacená objednávka vytvoří či aktualizuje řádek v `subscribers` se správným source/tagy; double opt-in flow projde end-to-end; selhání Postgres zápisu neshodí registraci.

---

## FÁZE 2 — Send engine, unsubscribe, tracking, reporting

**Úkoly:**

1. **Nové tabulky** (migrace): `campaign_recipients` (campaign_id, subscriber_id, status: pending/sending/sent/failed/skipped, provider_message_id, error, sent_at; unikát campaign+subscriber) a rozšíření `campaigns` o `html_body`, `audience_filter` JSONB (tagy include/exclude, statusy), `created_by`, `scheduled_at`, `finished_at`. Status kampaně: `draft` / `scheduled` / `sending` / `sent` / `cancelled`.
2. **Unsubscribe:**
   - podepsaný token per subscriber (HMAC, stejný secret jako opt-in)
   - `GET /unsubscribe?token=…` → potvrzovací stránka (jednoduchá veřejná route v Reactu) + `POST` → `status='unsubscribed'`, `unsubscribed_at`, event `unsubscribe` do `email_events`
   - hlavičky `List-Unsubscribe` (URL) + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` na každém marketingovém e-mailu
   - v patičce každé kampaně automaticky odkaz „Odhlásit se“
3. **Send engine** (Edge, spouštěný z admin endpointu + cronem pro naplánované):
   - `POST /admin/mailing/campaigns/:id/prepare` → vyhodnotí `audience_filter`, naplní `campaign_recipients` (jen `subscribed`, bez bounce/complaint), vrátí počet
   - `POST /admin/mailing/campaigns/:id/send` → status `sending`; worker bere dávky (např. 50) pending příjemců, renderuje HTML (merge fieldy, unsubscribe link, tracking), posílá přes Resend, zapisuje `sent/failed` + `email_events` typu `send`; opakované volání je idempotentní (pokračuje kde skončil) — kvůli Edge time-limitu se worker po ~45 s sám znovu zavolá (self-invoke) dokud jsou pending
   - pg_cron á 1 min: `scheduled` kampaně s `scheduled_at <= now()` → spustit send (vzor: webinar reminders cron + secret)
4. **Tracking:**
   - open pixel: `GET /t/o/:token.gif` → event `open` (dedupe per campaign+subscriber+hodina), update `last_opened_at`
   - click redirect: linky v HTML přepsat na `GET /t/c/:token?u=…` → event `click` + `email_links` + `last_clicked_at`, redirect 302
   - Resend webhook `POST /webhooks/resend` (ověření podpisu `svix`): delivered / bounced / complained → `email_events`; bounce/complaint → `subscribers.status='cleaned'`
   - noční job: přepočet `engagement_score` (jednoduchá heuristika z events za 90 dní)
5. **EmailBuilder napojení:**
   - nové tlačítko **„Odeslat kampaň“**: uloží kampaň do Postgresu (`campaigns` + HTML z editoru), zavolá prepare → dialog s počtem příjemců a výběrem tagů/filtru → potvrzení → send (nebo naplánovat přes existující `scheduledSendAt`)
   - test send předělat z Mailchimpu na Resend; allowlist přesunout z hardcodu (`EmailBuilder.tsx` ř. 89–94, `index.tsx` ř. 19068–19073) do env `MAILING_TEST_EMAILS`
   - push do Mailchimpu zatím ponechat jako druhé tlačítko (do cutoveru)
6. **Reporting:** nová admin stránka `/mailing/kampane` — seznam kampaní (status, odesláno, open rate, click rate, unsubscribes) + detail (čísla, top odkazy, chyby). Přidat do sidebaru v `AdminLayout.tsx`.

**Akceptace:** kampaň z EmailBuilderu se odešle na filtrovanou audienci přes Resend; unsubscribe funguje one-click i ze stránky; opens/clicks/bounces se objevují v `email_events` a v reportingu; naplánovaná kampaň odejde sama; odhlášený kontakt nikdy nedostane další kampaň.

---

## FÁZE 3 — Automatizace

**Úkoly:**

1. **Formát flow** v `automation_flows.definition` (JSONB): `{ trigger: { type: 'subscriber_created'|'tag_added'|'trial_activated'|'webinar_registered'|'order_paid', filter: {...} }, steps: [ { key, type: 'send_email'|'wait'|'condition'|'add_tag'|'remove_tag'|'exit', ... } ] }`. E-mail kroku odkazuje na uložený draft z EmailBuilderu (KV draft id) nebo vlastní HTML.
2. **Enrollment:** ve `upsertSubscriber()` a event místech (aktivace trialu, registrace webináře, zaplacení) volej `enrollInFlows(event, subscriberId)` — najde aktivní flows s odpovídajícím triggerem, vytvoří `automation_enrollments` (unikát flow+subscriber už je v DB).
3. **Runner:** pg_cron á 5 min → Edge endpoint `POST /cron/automation-runner` (secret): projde `active` enrollmenty, jejichž další krok je splatný (`context.next_run_at <= now()`), vykoná krok (send přes send engine — jednotlivé e-maily, ne kampaň; wait → posune `next_run_at`; condition → větev/exit), posune `current_step_key`, po posledním kroku `completed`. Unsubscribed subscriber → `exited`.
4. **Admin UI `/mailing/automatizace`** (nahradí `MailingPlaceholderPage`): seznam flows (název, trigger, aktivní toggle, počty enrollmentů), editor — lineární sekvence kroků (dropdown typ kroku + parametry, žádný vizuální canvas), detail flow s tabulkou enrollmentů a funnelovou statistikou (kolik prošlo kterým krokem).
5. **První 4 flows** (obsah dodá uživatel z exportu MC journeys — připrav strukturu a placeholder texty):
   1. Trial welcome (trigger `trial_activated`: den 0 uvítání, den 3 tipy, den 10 nabídka)
   2. Trial expirace (trigger `trial_activated` + wait do `trial_expires_at - 5 dní`)
   3. Webinar follow-up (trigger `webinar_registered` + wait do dne po webináři)
   4. Newsletter welcome (trigger `subscriber_created` se source `newsletter` po potvrzení opt-inu)

**Akceptace:** aktivace trialu založí enrollment a e-maily odcházejí podle časování; pauza flow zastaví odesílání; unsubscribe vyřadí z flow; funnel čísla sedí s `email_events`.

---

## FÁZE 4 — Segmenty a komfort (po ověření F2+F3 v provozu)

1. Tabulka `segments` (name, definition JSONB) + builder podmínek v admin UI (tagy AND/OR/NOT, contact_type, position_label, zájmy, trial stav, `is_customer`, engagement, poslední otevření) + použití segmentu v kampani i triggeru.
2. Knihovna šablon (uložené e-maily mimo drafty, duplikace kampaně).
3. Bulk operace v Audience: tagování výběru, export CSV.

## FÁZE 5 — Cutover (ruční koordinace s uživatelem)

1. Finální doimport z MC (kontakty + aktivita), porovnat počty.
2. Vypnout MC journeys ↔ zapnout vlastní flows (1:1 podle exportu).
3. Odstranit dual-write MC volání z registračních endpointů; webinar follow-upy přepnout na Postgres příjemce.
4. Odstranit „Push do Mailchimpu“ z EmailBuilderu, MC endpointy označit deprecated, secrets vyčistit. Ověřit nezávislost Mandrillu (transakce), jinak plán přesunu na Resend.
5. Vypnout legacy `/marketing/kontakty` + sync. Aktualizovat `docs/PROJECT.md`.

---

## CO NEDĚLAT

- Neměnit transakční e-maily (objednávky, webinar potvrzení/reminders) — běží na Mandrillu a fungují.
- Nemazat žádné Mailchimp endpointy/secrets před Fází 5.
- Nerefaktorovat `index.tsx` nad rámec úkolů (je obří, ale to není součást zadání).
- Nezavádět externí queue systém — stačí Postgres tabulka + cron + self-invoke worker.

## OTEVŘENÉ VSTUPY OD UŽIVATELE (nutné před Fází 3/5)

1. Co přesně dělá legacy `free-trial-ajax` (api.vividbooks.com) — jaké MC tagy/fieldy nastavuje trial formulář? (Bez toho se trial trigger napojí jen na `verify-token` aktivaci.)
2. Export obsahu všech aktivních Mailchimp journeys (texty, časování, podmínky).
3. Potvrzení Resend účtu + DNS pro `news.vividbooks.com`.
4. Ověření, že Mandrill přežije zrušení Mailchimp účtu.
