# Audit generování trialů (přístup zdarma)

**Datum:** 25. 8. 2026
**Rozsah:** kdy a kde vzniká obchod (deal) v Pipedrive, když si škola žádá o 14denní přístup zdarma.
**Podklady:** kód VIVIDBOOKS_WEB_ESHOP (`src/utils/trialSubmit.ts`, `src/supabase/functions/server/index.tsx`, `src/components/TrialPage.tsx`), blueprinty Make scénářů 6775847 a 6776646, živá data z Pipedrive (stages, dealy 26836/26839, aktivity z 25. 8. 2026).
**Sdílená verze:** https://claude.ai/code/artifact/525ded75-f0a9-4357-bf2b-e571129bb3a6

---

## 1. Kdo dnes vytváří trial dealy

Dealy zakládají **dva** nezávislé systémy; třetí (Make „Trial code – Generate") deal nezakládá, jen do existujícího dealu generuje kódy. Nad tím vším běží automatizace přímo v Pipedrive.

| Zdroj | Co to je | Stav |
| --- | --- | --- |
| **A · Make** | `[NB] [CZ1] Trial form v1.8 [Migrated]` (složka *1 Pro – Trial*, webhook `[TRIAL] [CZ1] Vividbooks webhook`, `hook.eu1.make.com/q3q9pku…`). Volá ho legacy backend `api.vividbooks.com` po **každém** odeslání formuláře /vyzkousejte. Zakládá deal **vždy** — pro case `new`, `activeFreeTrialYet` i `activeSubscriptionYet`. Bez deduplikace. | aktivní |
| **B · Web eshop** | Edge funkce `make-server-93a20b6f` (Supabase). Fire-and-forget volání z frontendu po odpovědi legacy API. Deal zakládá jen v „neúspěšných" scénářích. Má deduplikaci (otevřený trial deal → jen aktivita). | aktivní |
| **C · Make (Licensing)** | `[NB] [CZ, SK, ES] Trial code – Generate v1.0 [Migrated]` (složka *1 Pro – Licensing*). Deal **nezakládá** — hlídá dealy s nastaveným „Generate code" (filtr 135), volá `api.vividbooks.com/web/create-school`, zapíše kódy zpět. Kontrola každé 3 h mezi 6:00–23:00. | aktivní |
| **D · Pipedrive automatizace** | E-mail **CTA 01** + úkoly „New lead!" / „New Lead - Call" po vzniku dealu. Konfigurace automatizací není přes API čitelná — trigger nutno ověřit v UI Pipedrive. | neověřeno přes API |

---

## 2. Happy path: nový trial z webu

Formulář na `/vyzkousejte` (TrialPage) → legacy API → Make. Deal zakládá **Make**, web jen dohrává pole osoby.

1. Frontend ověří e-mail (`/validate-email`) a pošle formulář na `api.vividbooks.com/web/free-trial-ajax` (jméno, e-mail, telefon, pozice, škola, IČO, předměty, stupně, newsletter).
2. Legacy API vygeneruje kódy (učitel + student) a zavolá Make webhook s payloadem: `case=new`, teacherCode, studentCode, downloadLink, adminLink, position, dealer (UTM), whence, region…
3. Make najde organizaci (podle IČO v org poli `0f91eb…`, jinak podle názvu; když neexistuje, založí ji a přidá task „Merge organization"), najde/založí osobu podle e-mailu.
4. Make založí **deal** (vlastnosti níže) a k němu aktivity `Automated email – Trial CTA 02` (splatná +3 pracovní dny) a `Trial CTA 03 [CZ]` (+14 dní; víkend se posouvá na pondělí). U channel partnera místo CTA aktivit odejde e-mail partnerovi.
5. Vedle toho: záznam do datastore „Teacher database" (17501, dedup), Mailchimp tag „Trial form" (při souhlasu s newsletterem), studenti/rodiče dle staré Webflow logiky (dnes fakticky mrtvé větve — viz nález N2).
6. Web mezitím fire-and-forget zavolá `/trial-person-fields-pipedrive` — jen dohraje custom pole **osoby** 9093 (pozice), 9095 (předmět), 9099 (stupeň). Deal nezakládá (čeká až 20 s na asynchronně založenou osobu, `createIfMissing:false`).
7. Pipedrive automatizace na nový deal: e-mail **CTA 01** + úkol „New lead!" / „New Lead - Call".

### Vlastnosti dealu založeného Make (happy path i re-request)

| Vlastnost | Hodnota |
| --- | --- |
| Název | „Škola – Jméno Příjmení" (pro Parent/Homeschooling/Other: „Pozice – škola – jméno" — dnes mrtvá větev) |
| Pipeline / stage | 6 CZ-Sales-Akvizice-CZ1 / **37 Lead / Prospekt [CZ1]**. Channel partner (shoda UTM „dealer" v datastore Channel partners 48482): **43 Offer Accepted [CP2]** (pipeline 8). Pozice „Other" (mrtvá větev): deal bez organizace, stage 37, owner Gabriela. |
| Owner (kaskáda) | 1) channel partner (`owner_pd_id`) → 2) Parent/Homeschooling → 11629944 (mrtvá větev) → 3) obchodník podle UTM „dealer" (datastore 17503) → 4) obchodník podle kraje (datastore 17499; kraj z adresy org nebo z formuláře) → 5) owner posledního LOST dealu organizace (jen aktivní uživatel) → 6) default „Dan" z datastore 17503. |
| Label | case `new` → **359 „Trial web (interactive) - 2.0."**; case ≠ new → 52; Parent/Homeschooling → 81 — **POZOR: invertováno srpnovou migrací, původně přesně naopak (viz nález N0)** |
| Status / měna / hodnota | open · CZK · 0 |
| Kódy a odkazy | Teacher code `081392…`, Student code `aebc56…`, download link `265686…`, admin (reseller) link `e7173e…`; teacher code se zapisuje i na organizaci (`f657d2…`) |
| Case | `2cb764…`: 356 New / 357 Active free trial yet / 358 Active subscription yet |
| Expirace | **+14 dní** — textové pole `474d44…` („DD. M. YYYY"), datumové `d7d1ea…` a `expected_close_date` |
| Další pole | Owner-mirror `8d8285…`, „Teacher Email added to Delayed start database" (145, pole `ac8a24…`), Metabase dashboard link (`3cc7f2…`); **Pozice (`c16f27…`) a Odkud (`c2d2eb…`) zůstávají prázdné** — viz nález N2 |
| Aktivity | CTA 02 (+3 prac. dny, typ automation), CTA 03 (+14 dní, typ automation); u nové organizace task „Merge organization" |

---

## 3. Neúspěšné scénáře: dealy z webu (edge funkce)

Když legacy API žádost odmítne nebo vrátí existující kódy, frontend zavolá jeden ze čtyř endpointů. Všechny sdílí `syncTrialPipedriveDeal`: org podle IČO (org pole 4033, strict match), osoba find-or-create (s poli 9093/9095/9099), deduplikace přes otevřený trial deal, aktivita typu call splatná dnes + poznámka na dealu.

| Endpoint | Kdy | Pipeline / stage | Owner fallback | Poznámka aktivity |
| --- | --- | --- | --- | --- |
| `trial-email-used-pipedrive` | „Email is used yet." — e-mail už je u školy evidovaný | 6 / 37 Lead-Prospekt [CZ1] | current_deal_owner (4056) → owner z dealů → ENV → Gabriela Švédová (18026774) | „Opětovná žádost o kód." |
| `trial-existing-active-pipedrive` | Legacy vrátila existující kódy (škola má právě aktivní trial) | 6 / 37 | dtto | „Škola aktuálně má trial a žádá si o další." |
| `trial-active-subscription-pipedrive` | „You have active subscription trial yet." — škola má předplatné | 7 / 40 Kontaktováno [CZ2] (upsell) | current_deal_owner → owner z dealů (bez kódového fallbacku) | „Zákazník žádá o trial." |
| `trial-open-deal-pipedrive` | Škola „v jednání" (in_progress) — **nikde se nevolá**, viz nález N3 | 6 / 37 | dtto jako re-request | „Škola má v CRM rozjednaný obchod…" |

### Vlastnosti dealu založeného edge funkcí

- **Název:** „{Název organizace} - trial 2.0." (fallback: název školy z formuláře, krajně „IČO …").
- **Label:** 359 „Trial web (interactive) - 2.0." (pole 12463) — stejný jako u Make.
- **Deduplikace:** pokud má organizace jakýkoli *otevřený* trial deal (napříč pipeline i labely), nový deal nevznikne — jen aktivita s poznámkou „⚠️ Zákazník žádal o trial znovu (otevřený deal už existoval)." U nového dealu navíc vzniká samostatná poznámka (note) se stejným obsahem.
- **Bez kódů:** na rozdíl od Make deal neobsahuje teacher/student code ani expiraci (edge je nezná) — jen kontakt v notě.

---

## 4. Trial „na kliknutí" obchodníka (Licensing)

Scénář **[NB] [CZ, SK, ES] Trial code – Generate v1.0 [Migrated]** — jediný scénář ve složce Licensing, který se trialů týká. Deal nevytváří, pracuje nad existujícím:

1. Watch Deals (filtr 135): obchodník na dealu nastaví pole „Generate code". Kontrola každé 3 h mezi 6:00–23:00.
2. Validace: deal musí mít osobu i organizaci — jinak task „Kód nelze vygenerovat❗️" a pole se smaže.
3. HTTP POST `api.vividbooks.com/web/create-school` (název org, země dle pipeline_id, e-mail osoby, adresa, IČO, withFreeLicence dle pole `3f0c87…`).
4. Úspěch → do dealu: teacher/student code, download + admin link, **expirace +30 dní**, „Generated" (137 v poli `30a872…`), expected_close_date; teacher code i na organizaci; upload obrázku `licence_code.png`; Mailchimp tag „Trial sales".
5. Chyby: obecná chyba → task s detailem; „School with this vatNumber already exists" → task „Existing company ID❗️ … set up the trial manually".

---

## 5. Živý důkaz z Pipedrive (25. 8. 2026)

- **Deal 26836 (ZŠ Přerov, Boženy Němcové 16):** 13:20:32 založil **Make** (origin „Make (unpublished)"): pipeline 6, stage 37, label 359, case „New", kódy 2CQ8C5/M8HT2P, expirace 8. 9. 2026, aktivity CTA 02 (28. 8.) a CTA 03 (8. 9.). Ve 13:20:40–46 přiletěly z Pipedrive automatizace „New Lead - Call" a „New lead!" — a **web (edge)** díky deduplikaci na tentýž deal přidal jen aktivitu „Aktuálně aktivní trial" s ⚠️. Přesně takhle má souběh obou systémů fungovat.
- **Deal 26839 (Metropolitní odborná umělecká SŠ Praha 4):** 14:39:03, 14:39:29 a 14:39:33 — **tři totožné aktivity** „Kontaktovat zákazníka" (Opětovná žádost o kód), dvě s ⚠️. Opakovaná odeslání formuláře; dedup zabránil duplicitním dealům, ale aktivity se hromadí.
- **Otevřené „trial 2.0." dealy:** vyhledání vrací desítky otevřených dealů z edge funkcí v pipeline 6 (stage 37 → posouvané do Kvalifikace/Rozhodují se) i pipeline 7 (Kontaktováno [CZ2]) — obě webové větve reálně běží a obchodníci s nimi pracují.

---

## 6. Nálezy

### N0 · KRITICKÁ — Migrace Make scénáře obrátila přidělování štítků: nové trialy dostávají „trial 2.0." místo „Trial web" → neodchází CTA 01

**Symptom (25. 8.):** většina dealů založených 24.–25. 8. nese label 359 „Trial web (interactive) - 2.0.", CTA 01 (automatizace v Pipedrive s triggerem na label „Trial web" 52) u nich neodchází.

**Původní logika** (scénář `[NB] [CZ1] Trial form v1.8`, ID 775986, deaktivován 31. 7. 2026): po založení dealu následoval router **„What case?"** —

- case `new` → modul „Add label **Trial web**" (`PUT deals/{id}` s label 52; Parent/Homeschooling 81) + CTA 02/03 aktivity,
- case `activeFreeTrialYet | activeSubscriptionYet` → modul „Add label **Trial web 2.0**" (label 359), **bez** CTA aktivit.

Tedy: „trial 2.0." = jen re-request/upsell, CTA 01 jen k „Trial web". To odpovídá očekávanému chování.

**Migrovaná logika** (scénář `✅ v1.8 [Migrated]`, ID 6775847, aktivní od ~5. 8. 2026): router „What case?" zmizel a label se nastavuje přímo v modulech „New deal" formulí

```
label_ids = if(case != "new"; if(position = Parent|Homeschooling; 81; 52); 359)
```

— podmínka je **invertovaná**: case `new` → **359** „trial 2.0.", case ≠ new → **52** „Trial web".

*Upřesnění (ověřeno 25. 8.):* CTA 02/03 aktivity se navzdory zrušení routeru „What case?" stále zakládají **jen pro case `new`** — filtr `case = new` na modulu „Save email and name to database" zastaví v Make celou navazující větev, takže se k CTA modulům jiné case nedostanou. Potvrzeno na dealech 26810 (case 357) a 26819 (case 358): CTA aktivity nemají. Oprava se tedy týká **výhradně formule štítků**.

**Důkaz v datech (24.–25. 8.):** 14 Make dealů s case „New" (pole 2cb764… = 356) má label 359 (např. 26836, 26826, 26820, 26816, 26802…); jediné dva dealy s case ≠ new — 26810 (357 Active free trial yet) a 26819 (358 Active subscription yet) — mají label 52. Přesný opak původního stavu.

**Dopad:** (a) CTA 01 neodchází novým trialům; (b) hrozí, že CTA 01 odejde školám, které jen žádají o kód znovu / mají předplatné (label 52); (c) reporting podle štítků je od ~5. 8. zkreslený.

**Oprava — stav k 25. 8. 2026 16:31:**

1. ✅ **Data v Pipedrive přeštítkována** (hotovo přes API): 37 dealů case „New" z 5.–25. 8. přepnuto z labelu 359 na **52 „Trial web (interactive)"**, 2 dealy case „Active free/subscription trial yet" (26810, 26819) z 52 na **359**. Kontrolní přepočet pipeline 6: 39 dealů case=New má label 52, 3 dealy case≠new mají 359, **žádná nesrovnalost nezůstala**. Pipeline 7 zkontrolována zvlášť — 26823 (case 358 → 359) i webové dealy „… - trial 2.0." (26801, 26651) jsou správně.
2. ⏳ **Scénář 6775847 čeká na zápis do Make.** Opravený blueprint je připravený a ověřený (diff = přesně 6 změněných řádků, nic jiného), ale zapsat ho z této session nelze: Make MCP `scenarios_update` nahrazuje blueprint vcelku (512 kB — nad limit jednoho volání) a přímé volání `eu1.make.com` odmítá egress politika (403 na CONNECT). Dvě cesty, jak to dokončit:

   **A) Ručně v Make UI (doporučeno — 6× jedna změna znaku).** V modulech „New deal" **257, 258, 259, 260, 369, 383** v poli `label_ids` přepsat `!=` na `=`:
   ```
   {{if(30.case = "new"; if(30.position = "Parent" | 30.position = "Homeschooling"; 81; 52); 359)}}
   ```

   **B) Import připraveného blueprintu.** Soubor `trial-form-cz1-v1.8-FIXED.blueprint.json` (vygenerován 25. 8. z živého blueprintu scénáře). V Make: scénář → ⋯ → *Import Blueprint*. Před importem doporučeno scénář naklonovat jako zálohu — import přepíše celý scénář, takže jakákoli změna provedená ve scénáři po 25. 8. by se ztratila.

3. ⏳ Po opravě ověřit v Pipedrive → Automatizace, komu se mezi 5. a 25. 8. odeslala CTA 01 na dealy s labelem 52 (tehdy re-request/upsell) — případně dořešit s obchodem. Zároveň platí, že **přeštítkování z bodu 1 samo CTA 01 nespustí** (na dealu 26836 po změně labelu žádná nová aktivita nevznikla), takže těm 37 školám je potřeba CTA 01 doručit jinak.

### N1 · STŘEDNÍ — Dva systémy zakládají dealy pro tutéž žádost; chrání jen jednosměrná deduplikace
Make zakládá deal pro *každý* case (new, activeFreeTrialYet, activeSubscriptionYet) a deduplikaci nemá. Edge funkce dedupuje jen svoje dealy: když Make doběhne první (obvyklé — dnes 26836), edge přidá jen aktivitu. Když ale edge předběhne Make (webhook je asynchronní), vzniknou **dva dealy pro jednu žádost** — jeden „…- trial 2.0." (edge) a jeden „Škola – Jméno" (Make, label 52). *Doporučení:* deduplikaci doplnit i do Make scénáře, nebo zakládání dealů v ne-new cases nechat jen jednomu systému.

### N2 · VYSOKÁ — Rozbité mapování hodnot z nového webu v Make (Pozice/Odkud prázdné, mrtvé větve)
Make scénář (zděděný z Webflow) porovnává anglické hodnoty („Teacher", „Headmaster", „Parent", „Student", „Other"…), ale nový web posílá české („Učitel/ka", „Ředitel/ka", „Rodič", „Jiné"). Důsledky potvrzené na dealu 26836: deal pole **Pozice** (`c16f27…`) a **Odkud** (`c2d2eb…`) zůstávají null; větev Parent/Homeschooling (owner 11629944, label 81), větev „Other" (deal bez org, owner Gabriela) i studentská větev (e-mail s kódem místo dealu) se už nespustí — rodič z webu dnes projde školní větví. Právě proto vznikl edge endpoint person-fields, který pole **osoby** dohrává; pole na **dealu** ale nedohrává nikdo.

### N3 · NÍZKÁ — `trial-open-deal-pipedrive` je mrtvý kód
Endpoint (scénář „škola v jednání vyplnila formulář") je hotový včetně dokumentace, ale `notifyTrialOpenDealToPipedrive` se z frontendu nikdy nevolá — při stavu in_progress UI zobrazí kartu a formulář se neodešle. Buď záměr (pak smazat/označit), nebo chybí napojení.

### N4 · STŘEDNÍ — Opakovaná odeslání formuláře hromadí aktivity
Deal 26839: tři totožné aktivity během 30 sekund. Edge volání je fire-and-forget bez rate-limitu a dedup chrání jen dealy, ne aktivity. *Doporučení:* krátký cooldown na klienta (e-mail + IČO) nebo dedup aktivit v okně např. 10 minut.

### N5 · INFO — Rozdílná délka trialu: formulář +14 dní, obchodnický „Generate" +30 dní
Pokud je to záměr (sales trial delší), je vše v pořádku — jen to stojí za vědomé potvrzení.

### N6 · INFO — CTA 01 nelze přes API auditovat
E-mail CTA 01 posílá automatizace přímo v Pipedrive (spolu s úkoly „New lead!" / „New Lead - Call" — tvůrce 11629944, tedy účet API/automatizace). Konfigurace workflow automatizací není přes API dostupná; trigger (nový deal s labelem 359? i s labelem 52? jen pipeline 6?) je potřeba ověřit v Pipedrive → Automatizace.

---

## 7. Otevřené otázky

1. **CTA 01:** potvrzeno uživatelem, že trigger je label 52 „Trial web" — od migrace (~5. 8.) tedy CTA 01 u nových trialů neodchází (viz N0). Zbývá ověřit v Pipedrive → Automatizace, zda se CTA 01 mezitím neposlala dealům s labelem 52 = re-request/upsell.
2. **Legacy webhook:** volá `api.vividbooks.com` Make webhook opravdu pro všechny tři cases (dle dat ano) a překládá někde pozice do angličtiny? (Podle dealu 26836 nepřekládá.)
3. **Ne-new dealy:** má nadále dealy pro „žádost znovu / má předplatné" zakládat Make i web, nebo se má Make omezit jen na case new?
4. **Mrtvé větve:** chceme chování Parent/Student/„Jiné" z Webflow éry obnovit (opravit mapování), nebo z Make scénáře odstranit?

---

## Příloha: identifikátory

- **Make:** org 363890 (Vividbooks), team 225102 („My Team"); scénáře: 6775847 Trial form CZ1 (hook 434326), 6776646 Trial code – Generate; složky: 59436 *1 Pro – Trial*, 77933 *1 Pro – Licensing*; datastores: 17501 Teacher database, 17503 obchodníci/UTM, 17499 regiony, 48482 Channel partners.
- **Pipedrive:** pipeline 6 CZ-Sales-Akvizice-CZ1 (stage 37 Lead/Prospekt), pipeline 7 CZ-Sales-Upsell-CZ2 (stage 40 Kontaktováno), pipeline 8 [CP2] (stage 43 Offer Accepted); deal label 359 „Trial web (interactive) - 2.0.", starší 52, parent 81; org pole 4033 CIN/IČO, 4056 current_deal_owner; person pole 9093 pozice, 9095 předmět, 9099 stupeň; Gabriela Švédová 18026774, API/automatizační účet 11629944.
