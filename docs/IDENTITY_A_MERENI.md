# Kontakty napříč webem, aplikací a Pipedrive

> Koncepce a zadání kroku 1: **propojit identity** a **měřit chybějící události**.
> Signály, bannery a playbooky („hodně tiskne → nabídni sešit“) jsou **krok 2**.
>
> Stav k 13. 8. 2026. Inventura kódu + audit 29 972 live `subscribers` (mailing projekt `iekkundgizzdbmkzatdl`).

---

## 1. Shrnutí

Dnes není jeden kontakt. Pět úložišť se o člověka přetahuje a **nesedí na stejném klíči**. Audit navíc ukázal, že klíče, které jsme chtěli použít, v datech **neplatí**:

| Místo | Koho zná | Co ví | Past |
|-------|----------|--------|------|
| Mailing (`subscribers`) | **1 e-mail = 1 řádek** | jméno, anglická pozice, tagy, Mailchimp rating | IČO je rozbité; telefon skoro nikde; `contact_type` / `is_customer` / `last_opened_at` prázdné |
| Web KV | email + webinář / trial | registrace, docházka, někdy IČO a telefon | dva tvary webináře (plná registrace vs. jen certifikát) |
| Aplikace ultra | účet + `organization_code` + `external_teacher_id` | čas, učebnice, AI | jen 31 profilů; na org není IČO; school-code login bez profilu = 0 CS |
| Pipedrive | IČO školy, email osoby | škola, dealy, pozice 9093, předmět 9095, stupeň 9099 | nevidí app usage ani maily |
| Cookie `vb_id` | display jméno/email/škola | pozdrav, prefill | není auth, nic se neukládá |

**Kanonické klíče po auditu:**

- **osoba ≠ e-mail.** E-mail je adresa (1:N na osobu). Jedna učitelka často má 3 schránky. 1 917 stejných jmen na 2+ kontaktech, 439 na 3+.
- **škola = IČO jen když projde validací 8 číslic.** `subscribers.ico` / Mailchimp `MMERGE6` **nebrat** — z 5 982 „vyplněných“ je 22 platných.
- **slot v app** `(organization_code, external_teacher_id)` je nejsilnější linker osoby uvnitř školy. `organization_code` (např. PASCAL) je kód **školy**, ne učitele.

Web a aplikace zůstanou **dva Supabase projekty**. Surové eventy tam, kde vznikají. Na web patří graf identit.

**Krok 1 je hotový**, až umíme k **osobě** (ne k jednomu e-mailu) říct: škola (validní IČO + kód licence + Pipedrive org), poslední den v app, poslední mail engagement, poslední webinář, poslední identifikovaná stránka, jestli tiskl.

---

## 2. Co audit změnil oproti prvnímu návrhu

| Dřív | Teď |
|------|-----|
| `identity_people.email` unique | `identity_emails` 1:N; osoba nemá unique e-mail |
| Škola z `subscribers.ico` | IČO jen z trusted zdrojů + validace `\d{8}` |
| `contact_type` jako role | Role z `position_label` / SELECT / PD 9093 (contact_type je 29 954× `unknown`) |
| Předměty jen heuristika z tagů | Kanonické `subjects[]` z MMERGE7, trial, PD 9095, app preference |
| Open z `last_opened_at` | Sloupec je 0. Zatím `_mc_member_rating` + tagy `eng-*`; Resend eventy až poběží |
| `is_customer` na subscribers | Je 0. Zákazník = `orders` / PD won. Tag `Customer` (5 837) není nákup |
| Slučovat podle jména | **Nikdy.** Ani IČO + podobné jméno (kolegové na škole) |

Čísla (13. 8. 2026): 29 972 subscribers, 99,9 % `mailchimp_import`; telefon 25 lidí; dual-write webinář jako `source=webinar` jen 18 řádků; `email_events` 87× `delivered`, 0 open; objednávky 499, z toho 159 e-mailů v mailingu chybí; ultra 31 profilů / 16 párů (org, teacher_id).

---

## 3. Mapa současného stavu

### 3.1 Web / mailing (`iekkundgizzdbmkzatdl`)

| Úložiště | Identita | Co je pravda | Co lhát nebude |
|----------|----------|--------------|----------------|
| `subscribers` | email unique | jméno, `position_label` (SELECT), tagy, `merge_fields` (MMERGE7 předměty, `_mc_member_rating`) | `ico`, `contact_type`, `is_customer`, `last_opened_at`, `phone` |
| `email_events` | `subscriber_id` | zatím jen Resend `delivered` | open/click teprve až kampaně půjdou přes Resend |
| `orders` | `customer_email` | telefon, IČO (349× 8 číslic), `pipedrive_deal_id` | — |
| KV `webinar_reg_{id}_{email}` | email + webinář | plná reg: pozice, phone, škola, IČO, docházka; **nebo** jen certifikát: `certificateSchoolIco`, `birthDateIso` | MMERGE6 |
| KV `trial_request_email_*` | email | `ico`, `position`, `schoolName` | — |
| `marketing_contacts_93a20b6f` | MD5(email) | legacy snapshot | nepoužívat jako SoR |

Admin 360 osoby: `/mailing/audience`. Škola z PD: `GET /school-pipedrive-check`.

Webové koukání v DB **není** (jen GTM/GA4).

### 3.2 Aplikace ultra (`qypiuvqglsmxdsnyazih`)

| Úložiště | Identita | Poznámka |
|----------|----------|----------|
| `profiles` | UUID, email, `organization_code`, `external_teacher_id` | 31 řádků; 16 ověřených slotů; `library_subject_preference` |
| `platform_organizations` | `code` | název, CS kontakt — **bez IČO** |
| `cs_activity_log` | `user_id` | bez `profiles` se zápis zahodí |
| `user_workbook_print_orders` | — | tabulka je, nikdo nezapisuje |

Handoff už nese `vat` (IČO), `organizationCode`, `schoolName`. Cookie `vb_id` je jen display.

Dva různé „teacher kódy“:

1. **`organization_code`** (PASCAL) = licence **školy**. V Pipedrive na org jako „kód učitel“.
2. **`external_teacher_id`** = číselný **slot učitele uvnitř školy**. Unikátní jen pár `(organization_code, external_teacher_id)`.

### 3.3 Pipedrive

Obchodní SoR. Osoba: email, telefon, org, custom **9093 pozice**, **9095 předmět**, **9099 stupeň**. Org: IČO, kód školy, owner.

---

## 4. Principy

1. **Osoba a škola zvlášť**, spojené členstvím. Osoba má N e-mailů.
2. **Dva projekty zůstanou dva.** Kopíruje se identita, ne eventy.
3. **Pipedrive = obchod.** Ukládat `org_id` / `person_id` / owner, ne celý CRM.
4. **Opt-in zůstává na `subscribers.status` per e-mail.** Graf identit ≠ souhlas. Mail se posílá na adresu (unsubscribe per adresu). Engagement/tisk/webinář se sčítají na osobu. `vb_id` nesmí samo přihlásit k mailům.
5. **Měřit tam, kde to vzniká.**
6. **Neslučovat agresivně.** Lepší dva záznamy jedné učitelky než sloučení dvou kolegyň.
7. **Krok 2 až po akceptaci v §10.**

---

## 5. Krok 1 — graf identit

Domov: **web / mailing Postgres**. Tabulky nasazené 13. 8. 2026 (`20260813200000_identity_graph.sql`). Upsert: `POST /identity/upsert`. Backfill: `identity_backfill()` (1 subscriber = 1 osoba).

### 5.1 `identity_people`

Žádný unique e-mail.

| Sloupec | Účel |
|---------|------|
| `id` | UUID |
| `app_user_id` | UUID z ultra `auth.users`, unique nullable |
| `pd_person_id` | Pipedrive person, unique nullable |
| `first_name`, `last_name`, `phone` | denormalizace; telefon z checkout / webinář / PD, ne z Mailchimpu |
| `role` | kanonická role, viz §6 |
| `subjects` | `text[]` kanonických slugů, viz §6 |
| `school_stages` | `smallint[]` — 1 a/nebo 2 |
| `created_at`, `updated_at`, `last_seen_at` | |

Bez marketing statusu.

### 5.2 `identity_emails`

| Sloupec | Účel |
|---------|------|
| `email` | PK, `lower(trim)`, unique |
| `person_id` | FK `identity_people` |
| `subscriber_id` | FK `subscribers`, nullable |
| `source` | `mailchimp` / `webinar` / `checkout` / `app` / `pipedrive` / `vb_id` / `trial` |
| `is_primary` | jedna primární na osobu (nejčastěji školní `*.cz`, ne Gmail, pokud obě existují) |
| `created_at` | |

Mailing lookup: email → `identity_emails` → osoba. Opt-in dál na `subscribers` podle e-mailu.

### 5.3 `identity_orgs`

| Sloupec | Účel |
|---------|------|
| `id` | UUID |
| `ico` | unique nullable, **jen 8 číslic** po `regexp_replace(..., '\D', '', 'g')` |
| `organization_code` | unique nullable — licence v app |
| `pd_org_id` | Pipedrive org |
| `school_name` | display + fallback match |
| `pd_owner` | jméno/email obchodníka |
| `created_at`, `updated_at` | |

Dočasně může existovat org jen s `organization_code`. Až dorazí validní IČO, slít duplicitní řádky **škol**, ne lidí.

**Trusted IČO (v tomto pořadí):** `orders.ico` → trial KV → webinář `certificateSchoolIco` / `ico` → Pipedrive org CIN → app handoff `vat`.  
**Zakázáno:** `subscribers.ico` a `merge_fields.MMERGE6`, pokud neprojdou validací 8 číslic (projde ~22 řádků — ty ano).

### 5.4 `identity_memberships`

Unique `(person_id, org_id)`.

| Sloupec | Účel |
|---------|------|
| `role` | kanonická role v této škole (může se lišit od `people.role`, když je na víc školách) |
| `source` | `app_login` / `webinar` / `checkout` / `pipedrive` / `trial` / `vb_id` |
| `external_teacher_id` | slot v app, ne kód školy |
| `created_at` | |

Unique nullable `(organization_id, external_teacher_id)` tam, kde slot známe — jeden slot = jedna osoba.

### 5.5 `web_events` (jen identifikované)

Jen když známe e-mail. Ne GA clone. `vb_id` nesmí auto-subscribe.

| Sloupec | Účel |
|---------|------|
| `person_id` | FK |
| `occurred_at` | |
| `kind` | `subject` / `product` / `webinar` / `trial` / `other` |
| `path` | např. `/predmet/matematika` |
| `entity_id` | slug / product id / webinar id |

---

## 6. Slovníky (normovat při zápisu)

### 6.1 Role

Z `position_label` / Mailchimp SELECT / webinář / trial / PD 9093:

| Kanonická | Příklady vstupu |
|-----------|-----------------|
| `teacher` | Teacher, Physics teacher, Chemistry teacher, Other subject teacher, Učitel/ka, Učitel/ka na ZŠ/SŠ |
| `director` | Headmaster, Ředitel/ka, ředitel |
| `deputy` | Deputy director, Zástupce/kyně ředitele |
| `parent` | Parent, Rodič |
| `student` | Student |
| `homeschool` | Homeschooling |
| `school_admin` | Secretary/economist, ICT coordinator, Hospodářka, Institution |
| `other` | Other, Jiné, Kontakt (záznam bez plné registrace) |
| `unknown` | prázdné |

Mapování PD option ID už existuje v `index.tsx` (`mapPipedrivePersonPositionToOptionId`, trial/webinář mapy). Stejnou tabulku použít i sem.

### 6.2 Předměty

Kanonické slugy = `SUBJECT_INTEREST_SLUGS` + `other`:

`matematika`, `fyzika`, `chemie`, `prirodopis`, `prvouka`, `cesky-jazyk`, `other`.

| Zdroj | Tokeny |
|-------|--------|
| MMERGE7 / trial / PD 9095 | Physics → fyzika; Chemistry → chemie; Mathematics / Mathematics-1 / Mathematics-2 → matematika; NaturalHistory → prirodopis; PrimaryScience → prvouka; CzechLang-1 / CzechLang-2 → cesky-jazyk; Other* → other |
| App `library_subject_preference` | `stupen-1:matematika` → matematika + stage 1; `stupen-2:fyzika` → fyzika + stage 2 |
| Tagy `wb-*` / `Matematika_interest` | jen doplněk, nižší váha než MMERGE7 |

Stupeň: z přípony `-1`/`-2`, z PD 9099, z app `stupen-1`/`stupen-2`. Sjednotit (union), nepřepisovat.

---

## 7. Pravidla slučování

Pořadí, **první shoda vyhraje**. Žádný další pokus nesmí přilepit jinou osobu.

1. Stejný `(organization_code, external_teacher_id)` u ověřeného profilu → stejná osoba.
2. Stejný `pd_person_id` → stejná osoba.
3. Stejný e-mail → stejná osoba (přidej řádek do `identity_emails`, pokud chybí).
4. Stejný normalizovaný telefon, **jen když je v grafu unikátní** (1 osoba). Jinak nenavazovat.
5. **Nikdy:** stejné jméno; IČO + podobné jméno; stejná škola + Teacher.

Při konfliktu (e-mail A patří osobě 1, app slot patří osobě 2) **neslučovat automaticky** — zapsat `identity_merge_review` (email, person_a, person_b, reason) a nechat v adminu.

Backfill začíná bezpečně: **1 subscriber = 1 person + 1 email**. Sloty a PD person_id se přilepí později a teprve pak spojí e-maily.

---

## 8. Kdy se vazba zapíše

| Moment | Co se zapíše | Odkud |
|--------|----------------|-------|
| Login / handoff v app | org (IČO z `vat` + `org_code`); osoba (`app_user_id`, email, slot); členství | Ultra `POST /identity/upsert` |
| Webinář | email, role, phone, škola; IČO jen validní; u certifikátu `certificateSchoolIco` | KV + `subscribers` + `identity_*` |
| Trial | email, role, IČO z formuláře pokud validní | KV `trial_request_*` |
| Checkout | email, phone, IČO, škola, `is_customer` přes orders | `orders` |
| Newsletter / `vb_id` | jen email → osoba; **ne** subscribe | |
| Pipedrive school-check | `pd_org_id`, owner, IČO | už běží |

### 8.1 `POST /identity/upsert`

Secret (ne anon): header `X-Identity-Secret` nebo Bearer = `IDENTITY_UPSERT_SECRET` / service role.
Identifikovaný pageview z webu: `POST /identity/web-event` (anon stačí, nesmí subscribe).

Idempotentní.

```json
{
  "email": "jana@skola.cz",
  "app_user_id": "uuid",
  "first_name": "Jana",
  "last_name": "Nováková",
  "organization_code": "PASCAL",
  "ico": "12345678",
  "school_name": "ZŠ Example",
  "external_teacher_id": "3",
  "subjects": ["matematika", "prvouka"],
  "school_stages": [1, 2]
}
```

`external_teacher_id` je slot, ne kód školy. IČO se zapíše, jen když po normalizaci sedí `\d{8}`.

Aplikace volá po loginu a po obnovení handoff session (`vat` může dorazit později).

### 8.2 Změny v aplikaci

- Sloupec `ico` na `platform_organizations` (8 číslic). Plnit z handoffu `vat`.
- Login/handoff → web upsert (fire-and-forget).
- School-code session bez e-mailu: CS pod `(organization_code, external_teacher_id)`; až bude e-mail, sloučit na osobu.

---

## 9. Měření, které chybí

Už existuje, v kroku 1 se jen napojí (nekopírovat):

- mail: tagy `eng-*`, `_mc_member_rating`; později `email_events` open/click
- webinář: KV + tagy `wb-*`
- objednávky (pravda o zákazníkovi a často o IČO/telefonu)
- CS v app: `app_opened`, `library_lesson_opened`, … (jen u účtů s `profiles`)

Doplnit:

| Událost | Dnes | Úprava |
|---------|------|--------|
| `worksheet_printed` | `/knihovna/tisk/*` = `library_lesson_opened` | nová action; stejně `window.print` a PDF |
| `lesson_presented` | schéma je, frontend nevolá | log při startu live session |
| app session (school-code) | bez `profiles` se CS zahodí | logovat pod org + teacher slot |
| `web.identified_view` | jen GTM | hrubé eventy při známém e-mailu |
| `org.ico` | handoff má `vat` | sloupec na `platform_organizations` + `identity_orgs` |

`/knihovna/zobrazit/...` = čtení. `/knihovna/tisk/...` a explicitní print/PDF = `worksheet_printed`.

---

## 10. Akceptační kritérium

Na **osobu** (lookup e-mailem, `app_user_id` nebo slot) umíme ukázat:

1. všechny známé e-maily + která má mailing opt-in  
2. škola: validní IČO, `organization_code`, Pipedrive org + owner  
3. kanonická role + předměty + stupeň  
4. poslední den v app  
5. mail engagement (rating / `eng-*` / později last open)  
6. poslední webinář  
7. poslední identifikovaná stránka na webu  
8. jestli existuje `worksheet_printed`

Bez toho nezačínat krok 2.

---

## 11. Mimo krok 1

- Signály `prints_a_lot`, `never_tried_live`, `app_dormant`
- Bannery a playbooky
- Kopírovat GTM nebo celý `cs_activity_log`
- Nahradit Pipedrive / sloučit Supabase projekty
- Auto-merge podle jména
- Auto-subscribe z cookie
- Věřit `subscribers.ico` bez validace
- Brát tag `Customer` jako nákup

---

## 12. Pořadí implementace

Větve A (web) a B (app) můžou jít paralelně.

| # | Úkol | Repo |
|---|------|------|
| 1 | Tabulky `identity_people`, `identity_emails`, `identity_orgs`, `identity_memberships`, `web_events`, `identity_merge_review` + RLS staff | web |
| 2 | Helper: validace IČO, mapa role, mapa předmětů (sdílená s PD mapami) | web |
| 3 | `POST /identity/upsert` | web |
| 4 | Webinář (oba tvary), trial, checkout, newsletter, PD lookup, `vb_id` → `identity_*` | web |
| 5 | Identified `web_events` | web |
| 6 | Backfill: 1 subscriber = 1 person + 1 email; role z `position_label`; subjects z MMERGE7; IČO **ne** z MMERGE6; telefon/IČO z `orders` + trial/certifikát KV | web |
| 7 | `platform_organizations.ico` z handoffu `vat` | ultra — nasazeno 13. 8. 2026 |
| 8 | Login/handoff → web upsert (email, `app_user_id`, org, IČO, `external_teacher_id`, subjects) | ultra — nasazeno 13. 8. 2026 |
| 9 | Tisk → `worksheet_printed`; live → `lesson_presented`; CS pro school-code slot | ultra |
| 10 | Napojit `profiles.email` a PD `person_id` — tady teprve spojovat víc e-mailů jedné osoby | obojí |

Admin lookup po 1–4 a 6 stačí jako kontrola, i bez tisku.

---

## 13. Související kód

**Web**

- `src/lib/vividbooksPresence.ts` — cookie `vb_id`
- `src/supabase/functions/server/subscribersUpsert.ts`
- `src/supabase/functions/server/mailchimpContactsMigrate.ts` — mapování FNAME/SELECT/MMERGE5–6
- `src/supabase/functions/server/webinarAudienceRecompute.ts` — `wb-*`
- `src/supabase/functions/server/engagementAudienceRecompute.ts` — `eng-*`
- Pipedrive mapy pozice/předmět/stupeň v `src/supabase/functions/server/index.tsx` (~14131+)
- Webinář KV zápis tamtéž (`webinar_reg_*`, certifikát)

**Aplikace**

- `supabase/functions/api/context/teacher-handoff.ts` — `vat` = IČO
- `frontend/src/app/utils/activity-target.ts` — tisk dnes jako `library_lesson_opened`
- `supabase/migrations/20260810144500_customer_success_skip_profileless_writes.sql`
- `supabase/migrations/20260721113000_enforce_unique_teacher_profile_binding.sql`

---

## 14. Slovník

| Termín | Význam |
|--------|--------|
| Osoba | Učitel / kontakt; **ne** e-mail. Má N adres. |
| Adresa | Řádek v `identity_emails` + `subscribers`; opt-in per adresu |
| Organizace | Škola; klíč validní IČO, alias `organization_code` |
| `organization_code` | Licenční kód školy (PASCAL), ne osoba |
| `external_teacher_id` | Slot učitele ve škole |
| `vb_id` | Cross-site cookie, jen display |
| Identified event | Event s e-mailovou identitou |
| Signál | Krok 2: spočtená vlastnost z eventů |
