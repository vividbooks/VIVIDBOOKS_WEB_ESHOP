# Trial Vividbooks — mapa současného stavu a projekt „chytřejší trial“

> Vzniklo 13. 9. 2026 z průzkumu kódu (web, e-shop server, Kabinet), databází (Supabase „Vividbooks_Web+eshop“ a „Vividbooks Ultra“), schránky hello@ a exportu z Pipedrive v Kabinetu.
> Cíl: nejdřív **zmapovat**, co se s triálem dnes děje, kolik se ho reálně používá a proč ne — a teprve pak navrhnout, jak ho dávkovat chytřeji.

---

## 1 · Shrnutí

1. **Trial je hlavní obchodní cesta.** 63–76 % škol, které začaly platit, mělo v roce před nákupem trial. Bez triálu se prakticky neprodává.
2. **Web trial (14 dní) se používá málo a krátce.** Z 219 web triálů založených 10. 8.–6. 9. 2026 se do aplikace přihlásilo 32 % škol, druhý den se vrátilo 14 %, lekci si někdo promítl ve třídě v 0,5 %. Medián je **1 aktivní den**, průměrně 5 minut.
3. **Triály od obchodníků (30 dní) fungují skoro dvakrát lépe** (58 % přihlášení, 39 % vrací se) — mají osobní e-mail, telefonát a víc času.
4. **Konverze na placenou licenci padá.** Nové školy s prvním triálem: 2023 ≈ 8–13 % zaplatilo do roka, 2024 ≈ 7–8 %, 2025 ≈ 5–8 %, kohorty od Q4 2025 zatím 2–4 %. Medián od triálu k platbě je 20–60 dní.
5. **E-mailová péče o trial dnes prakticky neexistuje.** Učitel dostane jeden uvítací e-mail s kódy (generický, bez vazby na předmět) a pak dva obchodní CTA e-maily z Pipedrive. Mailchimp journey „Akademie Vividbooks“ z roku 2021 je mrtvá (1 otevření za 12 měsíců). Vlastní automatizace v adminu jsou jen placeholder.
6. **Data pro personalizaci máme, ale děravá.** 74 % kontaktů s tagem „Trial form“ nemá v Mailchimpu předmět. Make scénář „Trial form“ padá u celých kategorií pozic (např. „Učitel/ka na SŠ“), takže ti lidé do Mailchimpu nikdy nedojdou. Třetina „Trial form“ kontaktů jsou studenti a rodiče.
7. **Obchod triály honí, ale bez signálu z aplikace.** 65 % web triálů dostane do tří týdnů hovor, 90 % nějakou aktivitu v Pipedrive — a přesto se 68 % škol nikdy nepřihlásí. Voláme naslepo.

**Doporučení:** postavit trial jako produktový onboarding (co otevřít zítra v mé hodině), řízený chováním v aplikaci a znalostí předmětu/ročníku, s obchodníkem až tam, kde je vidět použití. Nejdřív ale měřit (fáze 0).

---

## 2 · Jak trial dnes vzniká (mapa toků)

### 2.1 Vstupy do triálu

| Kanál | Délka | Objem (10. 8.–6. 9. 2026) | Kde se zakládá |
|---|---|---|---|
| Web formulář `/vyzkousejte` | 14 dní, všech 6 předmětů | 219 (17 %) | legacy API `api.vividbooks.com/web/free-trial-ajax` |
| Obchodník / admin / Pošťák | 30–45 dní | 215 (16 %) | reseller admin (legacy), nově Kabinet |
| „Trial z aplikace“ (upsell — stávající zákazník zkouší další předmět) | 152 dní (!) | 873 (67 %) | legacy admin, `grant_reason = upsell` |
| Odkaz po registraci na webinář (`/vyzkousejte?token=…`) | vede na web formulář | 3 989 tokenů od března, 113 „aktivováno“ (2,8 %) | KV `trial_token_*` |
| E-mail na hello@ („Chci vyzkoušet předmět Matematika“) | 30 dní | desítky / měsíc | Pošťák → Kabinet |

Dlouhodobě: **300–600 triálů měsíčně**, špičky v září–říjnu a při kampaních (duben 2025: 1 518, září 2026: 1 167). Školní rok 2025/26 ≈ 4 600 triálů. Politika v Kabinetu: web 14 dní, obchodník 30 dní, cooldown 180 dní, upozornění 3 dny před koncem.

### 2.2 Web trial krok za krokem

1. **Formulář** (`src/components/TrialPage.tsx`): jméno, e-mail, telefon, pozice, škola (vyhledání + IČO), předměty (učitel) nebo stupně (vedení), GDPR, newsletter. Před odesláním: kontrola formátu a MX e-mailu, 6měsíční cooldown na e-mail (KV), karta stavu školy z Pipedrive (známá škola / rozjednaný obchod / aktivní předplatné).
2. **Odeslání** (`src/utils/trialSubmit.ts`): stále jde na **legacy API** (Symfony reseller admin). To založí školu a kódy, samo zapíše deal do Pipedrive (label „Trial web“). Odpověď s kódy se zobrazí na stránce + tlačítko „Otevřít aplikaci“ + tři školicí videa. **Most na Kabinet (`kabinet-trial`, nasazen 3. 9.) existuje, ale formulář ho nepoužívá** — tabulka `registr_trial_requests` má 0 řádků.
3. **Doplnění Pipedrive** (fire-and-forget, `make-server-93a20b6f`): pozice / předmět / stupeň na osobě (pole 9093/9095/9099); při odmítnutí kódů založí deal s labelem „Trial web (interactive) - 2.0“ a českou poznámkou proč.
4. **Make (Ninjabot) scénáře** navázané na legacy API:
   - „[CZ1] Trial form v1.8“ → Mailchimp kontakt + tag `Trial form` (+ zastaralý odkaz na `/school/cz/rozsirena-realita?teacherCode=`). **Padá** s chybou „Prohibited value in parameter SELECT“ u pozic mimo povolený seznam (např. „Učitel/ka na SŠ“) — 25+ chybových e-mailů za posledních 60 dní, tj. tyto kontakty do Mailchimpu nikdy nedojdou.
   - „[CZ, SK, ES] Trial code – Generate v1.0“ → odešle e-mail **„👋 Vítejte ve Vividbooks“** z hello@ (BCC do Pipedrive) jménem přiděleného obchodníka + přidá kontakt do Mailchimp „Akademie“ (journey z 2021, dnes prakticky neběží). Padá u odhlášených/bouncnutých adres.
5. **Pipedrive automatizace** (mimo repo): „Automated email – Trial CTA 02“ (422× v 2026) a „Trial CTA 03 [CZ]“ = „Přístup do Vividbooks je u konce“ (361× v 2026), úkoly „New lead!“ / „New lead - Call“ pro obchodníka, hovor „Aktuálně aktivní trial“ (183× od června).
6. **Kabinet (Ultra registr)** od 3. 9.: zrcadlí licence z legacy, hlídá expiraci (`trial_expiring` 144×, `trial_expired` 93× → aktivita v Pipedrive), Pošťák posílá „Zkušební přístup vám končí 17. září“ a kódy z e-mailových žádostí.
7. **Vlastní mailing (Postgres)**: flow „Trial welcome“ (den 0 / 3 / 10) a „Trial expirace“ (−5 dní) jsou v kódu jen jako **placeholdery**, tabulka `automation_flows` je prázdná, engine neběží. `subscribers.trial_status` má 113 řádků (jen aktivace přes webinářový token).

### 2.3 Co učitel reálně dostane

| Kdy | Co | Odkud | Obsah |
|---|---|---|---|
| ihned | stránka s kódy + „Otevřít aplikaci“ + 3 videa | web | videa jsou z rozhraní staré aplikace |
| ihned | „👋 Vítejte ve Vividbooks“ | Make → hello@ | kódy, do kdy platí, odkaz na Vividboard, pitch na tištěné sešity, kontakt obchodníka. Nic o předmětu ani ročníku. |
| den ~3–7 | „Trial CTA 02“ | Pipedrive automation | obchodní CTA (obsah v Pipedrive, ne v repu) |
| konec | „Přístup do Vividbooks je u konce“ (CTA 03) | Pipedrive | nabídka licence |
| −3 dny | úkol pro obchodníka | Kabinet → Pipedrive | interní |
| průběžně | telefonát „New lead - Call“ | obchodník | 65 % web triálů do 21 dní |

Nikde: „co otevřít zítra“, nic podle předmětu a ročníku, žádná reakce na to, jestli se učitel přihlásil.

---

## 3 · Čísla

### 3.1 Aktivace v nové aplikaci (kohorta triálů 10. 8.–6. 9. 2026, aktivita v okně triálu / max 30 dní)

Zdroj: `registr_licenses` × `registr_school_codes` × `cs_activity_log` (Ultra). Aktivita je vázaná na kód školy, ne na konkrétního učitele.

| Segment | Triálů | Přihlásil se někdo | ≥ 2 aktivní dny | ≥ 3 dny | Do 48 h | Otevřel lekci | Promítal lekci | Tiskl list | 2+ uživatelé | Medián dnů | Ø minut |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Web 14 dní | 219 | **32 %** | 14 % | 10 % | 22 % | 25 % | 0,5 % | 7 % | 2 % | 1 | 5 |
| Obchodník 30 dní | 215 | 58 % | 39 % | 30 % | 30 % | 51 % | 6 % | 13 % | 11 % | 3 | 10 |
| Upsell z aplikace | 873 | 59 % | 48 % | 39 % | 28 % | 56 % | 7 % | 14 % | 10 % | 4 | 10 |

Křivka web triálu: den 0 aktivních 45 škol (20 %), den 1 už jen 10, dál 3–14 denně. **Kdo se nepřihlásí v den 0, většinou se nepřihlásí vůbec** (z 71 aktivních škol jich 45 začalo v den 0, dalších 6 až v den 14 — nejspíš po expiračním e-mailu).

### 3.2 Konverze na placenou licenci (školy bez předchozí placené licence)

Zdroj: `registr_licenses` (první `free_trial` bez upsellu → první `paid`).

| Kvartál prvního triálu | Nových škol | Zaplatilo do 30 d | do 90 d | do 365 d | % do roka | Medián dní |
|---|---|---|---|---|---|---|
| 2023 Q1 | 889 | 12 | 47 | 119 | 13,4 % | 105 |
| 2023 Q2 | 657 | 135 | 170 | 185 | 28,2 % | 14 |
| 2023 Q4 | 526 | 11 | 19 | 43 | 8,2 % | 100 |
| 2024 Q1 | 515 | 12 | 27 | 39 | 7,6 % | 59 |
| 2024 Q2 | 579 | 18 | 32 | 49 | 8,5 % | 46 |
| 2024 Q4 | 626 | 8 | 13 | 25 | 4,0 % | 83 |
| 2025 Q1 | 582 | 18 | 26 | 41 | 7,0 % | 40 |
| 2025 Q2 | 671 | 18 | 25 | 34 | 5,1 % | 26 |
| 2025 Q3 | 405 | 17 | 27 | 31 | 7,7 % | 22 |
| 2025 Q4 | 860 | 7 | 11 | 14 | 1,6 % | 27 |
| 2026 Q1 | 515 | 10 | 11 | 20 | 3,9 % | 55 |
| 2026 Q2 | 289 | 5 | 8 | 11 | 3,8 % | 55 |

Podíl nových platících škol, které měly trial v roce před nákupem: 2023 76 %, 2024 67 %, 2025 68 %, 2026 63 %.

### 3.3 E-mailová báze triálů (Mailchimp import)

- Tag `Trial form`: 6 146 kontaktů — 4 869 subscribed, 680 cleaned (bounce), 590 odhlášeno. Za 180 dní něco otevřelo 37 %, kliklo 11 %.
- Pozice: Teacher 2 189, **Student 2 116**, Parent 521, Other 428, Physics teacher 263, Headmaster 199… → cca 43 % nejsou učitelé ani vedení.
- Předmět (MMERGE7) vyplněný jen u 26 %.
- Tag `Trial sales` (obchodnické triály): 3 377.
- Journey „Akademie Vividbooks“ (4 díly, 2021): za 12 měsíců 1 otevření. Journey „Welcome Email_CZ“ („Teď už vám nic neunikne“, 2021): 123 lidí za rok.

### 3.4 Obchodní dotyk u čerstvých triálů (stejná kohorta, aktivity v Pipedrive do 21 dní)

| Segment | Hovor | Trial CTA e-mail | Jakákoli aktivita |
|---|---|---|---|
| Web 14 dní | 65 % | 59 % | 90 % |
| Obchodník 30 dní | 73 % | 30 % | 93 % |
| Upsell | 14 % | 0 % | 28 % |

### 3.5 Co neumíme změřit (a proto je to v projektu)

- Návštěvy `/vyzkousejte` a dokončení formuláře (GA4 není propojená s daty; `identity_web_events` vidí jen identifikované).
- Kdo konkrétně (který učitel) v triálu pracoval — aktivita je na kód školy.
- Otevření a prokliky uvítacího e-mailu a Pipedrive CTA (jsou mimo naše tabulky).
- Kolik triálů z webinářů skončilo v aplikaci (token se „aktivuje“ jen přes `?token`).

---

## 4 · Proč se trial nepoužívá — diagnóza

1. **Chybí „co udělat zítra“.** Učitel dostane klíč od celého skladu (6 předmětů, tisíce stránek), ale ne konkrétní lekci pro svůj předmět a ročník. Den 0 je jediný moment, kdy má motivaci — a my ho utratíme za kódy a pitch na tištěné sešity.
2. **Trial není napojený na chování.** Nikdo neví, jestli se učitel přihlásil, co otevřel, kde se zasekl. Obchodník volá naslepo (65 % hovorů, 32 % přihlášení).
3. **Sekvence je obchodní, ne produktová.** CTA 02 / CTA 03 tlačí na licenci u lidí, kteří aplikaci ani neotevřeli.
4. **Personalizační data nedotečou.** Předmět u 26 %, Make padá u pozic, studenti a rodiče v učitelské audienci, žádný ročník.
5. **14 dní míjí rytmus školy.** Dva týdny často neobsahují hodinu na téma, které by učitel chtěl zkusit; obchodnické 30denní triály aktivují téměř 2×.
6. **Kódy školy místo osobního účtu.** Kódy se zobrazí jednou, e-maily „nemohu dohledat přístupové kódy“ chodí opakovaně, kolegové se k triálu nedostanou (2+ uživatelé jen u 2 % web triálů).
7. **Zastaralé onboardingové materiály.** Videa ze staré aplikace, odkaz na rozšířenou realitu v Make, Akademie 2021.
8. **Systémový dluh.** Tři paralelní systémy (legacy API + Make + Mailchimp, Pipedrive automatizace, Kabinet + Pošťák), nová cesta přes Kabinet nasazená, ale nezapojená.

Externí praxe říká totéž: 68 % triálů, které se neaktivují do 72 h, už nekonvertuje; behaviorální triggery mají 3–4× vyšší CTR než kalendářní; personalizace podle 2–3 otázek při registraci zvedá retenci 7. dne o 20–30 %; v edtechu je aktivace definovaná jako „učitel použil první materiál ve výuce“, ne „přihlásil se“. (Zdroje v příloze.)

---

## 5 · Projekt „Chytrý trial“

### 5.1 Cíl a hypotéza

Když učiteli během triálu **dávkujeme konkrétní materiál pro jeho předmět a ročník podle toho, co učí příští týden, a reagujeme na to, co v aplikaci dělá**, zvedneme aktivaci do 48 h z 22 % na 40 %+, návrat druhý den z 14 % na 30 %+ a konverzi do 90 dnů z ~4 % na 10 %+.

### 5.2 Metriky (North star + funnel)

**North star: „Použito ve výuce“** = škola v triálu má do 14 dnů aspoň jedno z: promítnutá lekce, vytištěný pracovní list, spuštěná relace / test, 2+ učitelé přihlášeni.

Funnel (měřit týdně, po kohortách a po kanálech web / obchodník / webinář / upsell):

| # | Krok | Zdroj dat | Dnes (web 14 d) | Cíl 3 měsíce |
|---|---|---|---|---|
| 1 | Návštěva `/vyzkousejte` | GA4 + `funnel_events` | neměříme | měřit |
| 2 | Odeslaný formulář | Kabinet `registr_trial_requests` | 0 (jde mimo) | 100 % žádostí |
| 3 | Kódy vydány + uvítací e-mail doručen | Kabinet + provider webhook | ? | 98 % |
| 4 | První přihlášení do 48 h | `cs_activity_log` | 22 % | 40 % |
| 5 | Otevřel lekci / list svého předmětu („aha“) | `cs_activity_log` | 25 % | 45 % |
| 6 | Vrátil se 2. den (retence D1–D7) | `cs_activity_log` | 14 % | 30 % |
| 7 | **Použito ve výuce** | `cs_activity_log` | ~8 % | 20 % |
| 8 | Kolega přihlášen (2+ uživatelé) | `cs_activity_log` | 2 % | 10 % |
| 9 | Kontakt obchodníka **po** signálu použití | Pipedrive | naslepo | 100 % PQL do 24 h |
| 10 | Placená licence do 90 dnů | `registr_licenses` | ~4 % | 10 % |

E-mailové metriky per krok sekvence: doručeno / otevřeno / kliknuto / odpovědělo; chybovost Make; úplnost dat (předmět, ročník, pozice) u nových triálů.

### 5.3 Návrh dávkované sekvence (řízené chováním, ne kalendářem)

Každý e-mail má jedno CTA a jeden konkrétní materiál — **deep link na stránku v Knihovně** (kód stránky funguje i v tištěném sešitě). Obsah vybírá AI z `library_search_index` podle předmětu, ročníku a odpovědi učitele.

| Krok | Trigger | Obsah | Personalizace |
|---|---|---|---|
| 0 | kódy vydány (ihned) | kódy + „Učíte fyziku v 7.? Zítra můžete otevřít lekci *Hustota* — tady je“ + 1 otázka: **„Co učíte příští týden?“** (odpověď e-mailem nebo klik na 3 nabídnutá témata) | předmět + ročník z formuláře; téma z tematického plánu podle týdne v roce |
| 0b | učitel odpověděl | AI sestaví mini-plán: lekce + pracovní list (PDF) + písemka k tématu, odkaz rovnou na stránku | téma učitele |
| 1 | žádné přihlášení do 24 h | kódy znovu, 90s video pro jeho předmět, „stačí 5 minut: otevřete tohle“ | předmět |
| 1 | přihlásil se, nic neotevřel / otevřel X | „Otevřeli jste *X*, navazuje na to pracovní list *Y* s řešením“ | z `cs_activity_log` |
| 3 | přihlášen | „Vygenerovali jsme vám pracovní list na *téma*“ (editor pracovních listů + AI) — reálný osobní artefakt | téma |
| 5 | aktivní | pozvat kolegy (kódy jsou pro celou školu) + Vividboard: „test se opraví sám“ | předmět kolegů, pokud známe sborovnu |
| 7 | neaktivní | záznam webináře „Jak nadchnout žáky pro *předmět*“ + DVPP certifikát | předmět |
| 10 | kdokoli | rekapitulace použití („otevřeli jste 4 lekce, vytiskli 2 listy“) + jak funguje licence (94 Kč/žák/rok) + kalkulačka | z aplikace + počet žáků z MŠMT |
| 13 | aktivní | „Končí vám přístup — prodloužíme o 30 dní?“ (1 klik) + obchodník se ozve | — |
| 13 | neaktivní | „Co vám chybělo?“ (3 chipy) → odpověď zakládá úkol v Pipedrive | — |
| 15+ | PQL (použito ve výuce) | handoff obchodníkovi s přehledem použití, ne generický hovor | — |

Pravidla: kdo dosáhne cíle kroku, další krok přeskočí; každé odeslání a klik se zapisuje do `registr_person_activity`; obchodník vidí signály v Kabinetu / Pipedrive.

### 5.4 Fáze

**Fáze 0 — Měřit a zastavit krvácení (2 týdny)**
- Přepnout `/vyzkousejte` na `kabinet-trial` (most je nasazený) → každá žádost v `registr_trial_requests` s předmětem, stupněm, pozicí.
- Dashboard aktivace: SQL nad `cs_activity_log` × `registr_licenses` po kohortách a kanálech (dotazy z tohoto dokumentu), týdenní snapshot.
- Události `/vyzkousejte` (zobrazení, začátek vyplňování, odeslání, kódy) do `funnel_events` + GA4.
- Opravit Make „Trial form“ (SELECT hodnoty pozic) nebo ho nahradit zápisem z Kabinetu; vyřadit studenty/rodiče z učitelské audience; vypnout mrtvou journey Akademie.
- Vyměnit 3 školicí videa za záznamy miniwebinářů k nové aplikaci.

**Fáze 1 — Data a obsah (3–4 týdny)**
- Do formuláře přidat **ročník(y)** (u učitele) a volitelně „co učíte příští týden“.
- Obsahová mapa: předmět × ročník × týden školního roku → stránky v Knihovně (z tematických plánů a `curriculum_weekly_plans`).
- Texty a šablony e-mailů podle skillu `vividbooks` (hlas značky, žádné nepodložené feature claimy pro 1. stupeň).
- Personalizovaný uvítací e-mail posílat z Kabinetu (Pošťák umí odesílat, má registr) místo Make.

**Fáze 2 — Engine a AI (4–6 týdnů)**
- Behaviorální triggery z `cs_activity_log` (Kabinet je čte) → enrollment do flow (`automation_flows` + engine, který je v zadání mailingu — fáze 3).
- AI krok: odpověď učitele → RAG nad `library_search_index` → mini-plán; generování pracovního listu přes editor.
- Obchodní handoff: PQL událost do Pipedrive s přehledem použití; zrušit slepé „New lead - Call“ u neaktivních.

**Fáze 3 — Experiment a ladění (průběžně)**
- A/B: dnešní sekvence vs. nová, na web triálech; hodnotit kroky 4–7 a 10 po 30 a 90 dnech.
- Test délky triálu: 14 vs 21/30 dní pro web.
- Rozšířit na webinářové a upsell triály.

### 5.5 Otevřené otázky pro tým

1. Obsah Pipedrive automatizací „Trial CTA 02/03“ — kdo je vlastní, chceme je zachovat, nebo přesunout do nové sekvence?
2. Make scénáře (Ninjabot): opravit, nebo definitivně nahradit Kabinetem? Kdo má přístup k eu1.make.com/225102?
3. Souhlasy: uvítací a onboardingové e-maily jsou transakční / oprávněný zájem, newsletter ne — držet oddělené.
4. Osobní účet v triálu (e-mail + heslo / Google) místo jen kódu školy — dá identitu pro měření i pro kolegy. Nová aplikace to už umí.
5. Délka web triálu: dvě zářijové týdny často nestačí; 21 dní jako test?

---

## Příloha A · Kde co je

| Věc | Místo |
|---|---|
| Web formulář | `src/components/TrialPage.tsx`, `src/utils/trialSubmit.ts`, `src/utils/trialSubjectOptions.ts` |
| Most na Kabinet | `supabase/functions/kabinet-trial/index.ts` |
| Pipedrive doplnění / scénáře | `src/supabase/functions/server/index.tsx` (`syncTrialPipedriveDeal`, `/trial-*-pipedrive`), `supabase/functions/_shared/trial-pipedrive-note.ts` |
| Webinářový trial token | `src/supabase/functions/server/index.tsx` (`trial_token_*`, `/verify-token`), `src/components/WebinarPostRegistrationTrial.tsx` |
| Placeholder flows | `src/supabase/functions/server/index.tsx` (`Trial welcome`, `Trial expirace`), `automationEngine.ts` |
| Licence, kódy, aktivita, CRM události | Ultra: `registr_licenses`, `registr_school_codes`, `cs_activity_log`, `registr_crm_events`, `registr_pipedrive_activities`, `registr_settings.trial_policy` |
| Mailchimp export | Web: `subscribers`, `tags`, `subscriber_tags`, `campaigns`, `email_events` |
| Make scénáře | eu1.make.com/225102 — „[CZ1] Trial form v1.8“, „[CZ, SK, ES] Trial code – Generate v1.0“ (chybové e-maily chodí na support@ninjabot.cz) |
| Pipedrive automatizace | Pipedrive → Automations („Trial CTA 02“, „Trial CTA 03 [CZ]“) |

## Příloha B · Zdroje k dobré praxi

- ProductLed — SaaS onboarding email best practices (welcome → usage tips → sales touch → usage review → expiry; tři tracky: quick win, hook, conversion; kdo dosáhl cíle, další e-maily nedostává): https://productled.com/blog/user-onboarding-email-best-practices
- Lifecycle Architect — Onboarding optimization for EdTech (aktivace = učitel zadal první úkol; 2–3 otázky při registraci; D1 35–45 %, D7 20–30 %, free-to-paid 15–20 %): https://lifecyclearchitect.com/guides/onboarding-optimization-for-edtech/
- Arcade — Free trial conversion playbook 2026 (68 % triálů bez aktivace do 72 h nekonvertuje; personalizace podle 2–3 datových bodů +20–30 % D7): https://www.arcade.software/post/free-trial-conversion-playbook-2026
- Userpilot — SaaS trial conversion benchmarks (medián PLG 19 %, top kvartil 25–30 % s behaviorální automatizací): https://userpilot.com/blog/saas-average-conversion-rate/
- Mailsoftly — Onboarding email best practices 2026 (5–8 e-mailů za 14 dní; behaviorální triggery 3–4× CTR): https://mailsoftly.com/blog/user-onboarding-email-best-practices/
- Open Loop Studio — Free trial onboarding emails for B2B SaaS: https://openloopstudio.co/best-practices-for-free-trial-onboarding-emails/
- RAND — Harnessing the benefits of EdTech (bariéry: čas, školení, technika): https://www.rand.org/pubs/commentary/2026/01/harnessing-the-benefits-of-edtech-what-research-tells.html
- EdTech Digest — EdTech doesn't have an adoption problem, it has an implementation problem: https://www.edtechdigest.com/2026/08/11/edtech-doesnt-have-an-adoption-problem-it-has-an-implementation-problem/
