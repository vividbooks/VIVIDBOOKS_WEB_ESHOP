# Studentský program — studenti učitelství

Cíl: dostat Vividbooks ke studentům pedagogických fakult (a dalších fakult s učitelstvím) tak, aby do škol přicházeli jako uživatelé, kteří materiály znají, tvoří si v aplikaci vlastní přípravy a přinesou je do svých sboroven.

| Kde | Co |
|---|---|
| `/studenti` | Microsite: registrace univerzitním e-mailem, ověření odkazem, přihlašovací (učitelský) kód. `?f=<faculty-id>` předvyplní fakultu (odkaz pro fakulty), `?t=<token>` = ověření. |
| `/studenti/aktualizace?t=<access_token>` | „Můj přístup“: „ještě studuji / dostudoval jsem / kam nastupuji“, telefon, osobní e-mail, používání, zpětná vazba. **Jediné veřejné místo, kde je vidět kód pro žáky** (s poznámkou „pro nácvik se žáky na praxi“). |
| `/studenti/obnovit?t=<renewal_token>` | Roční obnovení jedním kliknutím (odkaz chodí na univerzitní e-mail). |
| `/marketing/studenti` | Admin: Přehled (cíle a progress), **Měření** (úspěšnost univerzit a používání aplikace), Studenti (CRM), Fakulty (pokrytí, kontakty, oslovení), Cíle a nastavení, Metodika. |
| `src/supabase/functions/server/studentProgram.ts` | Edge logika (v `make-server-93a20b6f`). |
| `src/components/studentProgram/StudentShowcase.tsx` | Sekce microsite: hero s tabletem a obálkami, předměty (obálky sešitů ze Supabase Storage přes `render/image`), „Co v aplikaci najdete“ (lekce, animace a 3D, listy, testy, vividboard, matematické aplikace, vlastní materiály — snímky z CDN webu a `public/`), „Na praxi i na seminář“. |
| `src/supabase/functions/server/studentProgramMeasurement.ts` | Výpočet měření (čistá logika, testy v `scripts/run-unit-tests.ts`). |
| `src/supabase/functions/server/studentProgramAccess.ts` | Čistá logika napojení na Kabinet (tělo hooku, obnova, výklad odpovědi, kód do e-mailu); testy v `scripts/run-unit-tests.ts`. |
| `supabase/functions/_shared/student-program-faculties.ts` | Seznam fakult, domény, IČO, detekce univerzitního e-mailu. Sdílí web i server. |
| `supabase/migrations/20260903120000_student_program.sql`, `20260927120000_student_program_renewal.sql` | Tabulky `student_program_*`, RLS (staff čte, service_role píše), pg_cron `student-program-daily`, sloupce ročního obnovení. |
| `docs/STUDENT_PROGRAM.md` | Tenhle dokument. |

## Cesta studenta

1. **Registrace** — jméno, **univerzitní e-mail** (živá kontrola domény → univerzita a fakulta) a **osobní e-mail** (povinný, mimo univerzitu), volitelně telefon, obor, stupeň a předměty, souhlas, newsletter. `POST /student-program/register`.
2. **Ověření** — odkaz na univerzitní e-mail (platí 7 dní). `GET /student-program/verify?t=` → Kabinet založí studentovu organizaci a roční licenci, stav `active`, `access_valid_until` = konec licence z Kabinetu. Uvítací e-mail jde na oba e-maily **jen s učitelským kódem** a návodem k přihlášení, kontakt do `subscribers` (tag `student-program`, `studenti-<faculty>`), `access_token` pro self-service.
3. **Roční obnovení** (cron) — 30 dní před koncem přijde na univerzitní e-mail odkaz `/studenti/obnovit?t=<renewal_token>` (na osobní e-mail jen upozornění „mrkněte do univerzitní schránky“). Připomínky 7 dní před, v den konce a 14 dní po (`renewal_stage` 1–4). Kliknutí = `GET /student-program/renew` → další roční licence v Kabinetu (od většího z dneška a současného konce), `renewal_count + 1`, stejný kód.
4. **Bez obnovení** — 30 dní po konci (`renewalGraceDays`) stav `expired` + e-mail. Nová registrace vypršelého studenta stejným univerzitním e-mailem pošle rovnou obnovovací odkaz.
5. **Absolvent** — v `/studenti/aktualizace` nahlásí „dostudoval/a“ a školu (rejstřík škol). Stav `alumni`, přístup doběhne do konce zaplaceného roku, dál se neobnovuje. Známá škola → okamžité upozornění na `digestEmail` (lead pro obchod).

Stavy: `pending → active → (expired | alumni)`, vedlejší `declined` (ukončil studium), `unsubscribed`.

## Kódy a licence: hook Kabinetu `/student-access`

Každý student má **vlastní školu a vlastní kódy**. Od 27. 9. 2026 je zakládá Kabinet (Ultra,
`POST …/api/registr/hooks/web/student-access`, tajemství `KABINET_SECRET` = `REGISTR_MAKE_SECRET`).
Studentský přístup je definovaný jako B2C:

- ve starém systému škola „Student univerzity: Jméno Příjmení (fakulta)“, v Kabinetu organizace `kind='student'`,
- individuální placená licence na všechny předměty (bundle), interaktivně, na `licenceMonths` (12),
- **žádný trial, žádný obchod v Pipedrive, žádné přepnutí školy na licence z Kabinetu.**

| Volání | Tělo | Výsledek |
|---|---|---|
| Ověření (a admin „Založit kódy“) | `universityEmail`, `personalEmail`, `firstName`, `lastName`, `faculty`, `startsOn` (dnes), `endsOn` (+12 měsíců) | `action`: `created` (nová škola), `adopted` (student už v Kabinetu školu má, přidá se jen licence), `existing` (licence do `endsOn` už je — opakované ověření nic nezaloží) |
| Obnova (odkaz i admin „Prodloužit o rok“) | totéž + `teacherCode`, `startsOn` = max(dnes, současný konec) | `renewed`, případně `existing`; kód musí patřit organizaci `kind='student'` |

Uloží se `teacher_code`, `student_code`, `codes_valid_until` = `endsOn`. Výsledek v `legacy_result`:
`kabinet_student_access` (v `legacy_reason` je `action`), jinak `kabinet_student_error` s důvodem
(HTTP status, `code` a text z Kabinetu) — student jde do fronty *Bez kódů* a admin dostane upozornění.

Ověřovací odkaz se atomicky „zabere“ (token → null), takže dvojklik nebo přednačtení odkazu
poštovním klientem nezavolá Kabinet dvakrát; druhý požadavek počká na výsledek prvního.

Starý trial formulář (`free-trial-ajax`, trial + obchod „Trial form“ v Pipedrive) a pojistka
`trial-check` se už nepoužívají. Starý `create-school` deduplikoval školy podle DIČ, proto Kabinet
posílá unikátní umělé `vatNumber` (`stu-` + 12 písmen z hashe e-mailu) — detail v
`docs/licensing/REGISTR-PROVOZ.md` v repu Ultra.

**Kde je vidět který kód:** e-maily (uvítání, obnova, znovuzaslání) a stránka po ověření jen
učitelský kód. Kód pro žáky vrací jen `/student-program/me` a `/update` (stránka „Můj přístup“).
Admin vidí oba.

Tajemství: `KABINET_SECRET` (project-wide, sdílí s `kabinet-trial`), volitelně `KABINET_API_BASE`, `KABINET_ANON_KEY`.

## E-maily

Transakční e-maily jdou přes Mandrill (hello@vividbooks.com). Když Mandrill selže (26.–27. 9. 2026 vracel `Invalid API key` pro celý web), e-mail odejde přes **Resend** (news@news.vividbooks.com, Reply-To hello@) a v události je `mailDetail: resend-fallback (…)`.

## Měření (admin → Měření)

`GET /admin/student-program/measurement` spojí studenty z webu s **všemi studentskými
školami v Kabinetu** (hook `/student-usage` s `all: true`, i studenti ze starého Webflow
formuláře) a jejich používáním **nové aplikace** (`cs_activity_log` podle učitelského
i žákovského kódu; stará aplikace se nepočítá). Osoba se páruje podle učitelského kódu.
Univerzita: z fakulty v registraci, u starších studentů z domény e-mailu, jinak *Nezařazeno*.

- **Trychtýř:** mají přístup → vyzkoušeli aplikaci → aktivní 30 dní → pravidelní (5+ dní) → se žáky (aktivita pod žákovským kódem).
- **Úspěšnost univerzit:** pořadí podle aktivních za 30 dní, pak podle vyzkoušelo; pokrytí = studenti s přístupem na 100 odhadovaných studentů učitelství na PedF.
- **Nové přístupy a první použití** po měsících, **předměty** (normalizované z `subject`, slugy knih se mapují na předmět), **nejaktivnější studenti**, počet studentů s přístupem déle než 14 dní, kteří aplikaci ještě neotevřeli.

Když Kabinet neodpoví, záložka to napíše a ukáže jen data z webu.

## Měřitelné cíle (admin → Cíle)

| Cíl | Výchozí | Jak se měří |
|---|---|---|
| Aktivní studenti | 300 do 30. 6. 2027 | stav `active` / `graduating` / `alumni` |
| Pokrytí PedF | 9 / 9 | fakulta typu `pedf` s ≥ 1 aktivním studentem |
| Partnerské fakulty | 5 | `outreach_status = partner` (oficiální rozeslání nebo workshop) |
| Používá Vividbooks | 50 % | `uses_in_practice = true` z těch, kdo vyplnili aktualizaci |
| Absolventi se známou školou | 60 % | `employer_school_name/ico` u `alumni` + `expired` |

Denní digest (`digestEmail`, výchozí vitek@vividbooks.com): nové registrace, ověření, obnovení, aktualizace údajů, studenti čekající na obnovení, studenti bez kódů.

## Fakulty a oslovení

Seznam: 9 pedagogických fakult (jádro) + fakulty s učitelskými programy (MFF, PřF, FF, FTVS, FPF SU, FHS UTB, IVP ČZU, …). U každé: odhad studentů učitelství (editovatelný), stav oslovení, garant, follow-up, vzorky, workshop, kontakty (proděkan pro studium, vedoucí kateder didaktiky, studijní oddělení).

Šablony jménem Vítka (`renderOutreachTemplate`): úvod vedení fakulty, úvod katedře (vzorky sešitů zdarma + workshop), připomenutí, text pro studenty k přeposlání. Odesílá se **jen po kliknutí** v adminu přes Mandrill (from hello@vividbooks.com, Reply-To vitek@vividbooks.com); zapisuje `last_contacted_at`, follow-up +12 dní, událost.

## Provoz

- **Cron** `student-program-daily` (07:10 UTC) → `POST /cron/student-program`, secret `MAILING_CRON_SECRET` (stejný jako mailing): výzvy k obnovení, vypršení, digest. Ručně z adminu: „Denní běh nasucho / naostro“.
- **Deploy**: migrace přes Supabase (push/`supabase db push`), Edge funkce `make-server-93a20b6f` se nasadí workflow po změně `src/supabase/functions/server/**`. Frontend push do `main`.
- **Secrets**: Mandrill, service role, `MAILING_CRON_SECRET` a **`KABINET_SECRET`** (project-wide, sdílí s `kabinet-trial`).
- **RLS**: tabulky čte jen staff (`is_staff_email()`), zapisuje service_role přes Edge.
- **Redirecty**: `/cs/studenti` a `/cs/studenti-ucitelstvi/*` → `/studenti`; externí přesměrování `/studenti` na starý web zrušeno.

## Co ověřit po nasazení

1. `KABINET_SECRET` je v Supabase Secrets projektu (nasazená funkce `kabinet-trial` ho už používá).
2. Registrace testovacím univerzitním e-mailem + osobním e-mailem → ověřovací e-mail → učitelský kód na oba e-maily. Ve starém adminu vznikne škola „Student univerzity: … (…)“, v Kabinetu hned organizace `kind='student'` s roční individuální licencí; v `registr_crm_events` nic.
3. V adminu u studenta „Poslat výzvu k obnovení“ → kliknout na odkaz → platnost se posune o rok, `renewal_count = 1`.
4. `POST /admin/student-program/run-cron?dryRun=1` → bez chyb.
5. 108 importovaných kontaktů: fronta *Importovaní z kontaktů* → „Pozvat“; import nemá osobní e-mail, ten si student doplní v aktualizaci (registrace ho vyžaduje, ověření pozvánky ne).
