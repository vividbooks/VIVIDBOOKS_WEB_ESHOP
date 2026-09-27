# Studentský program — studenti učitelství

Cíl: dostat Vividbooks ke studentům pedagogických fakult (a dalších fakult s učitelstvím) tak, aby do škol přicházeli jako uživatelé, kteří materiály znají, tvoří si v aplikaci vlastní přípravy a přinesou je do svých sboroven.

| Kde | Co |
|---|---|
| `/studenti` | Microsite: registrace univerzitním e-mailem, ověření odkazem, kódy. `?f=<faculty-id>` předvyplní fakultu (odkaz pro fakulty), `?t=<token>` = ověření. |
| `/studenti/aktualizace?t=<access_token>` | Self-service: „ještě studuji / dostudoval jsem / kam nastupuji“, telefon, osobní e-mail, používání, zpětná vazba. |
| `/studenti/obnovit?t=<renewal_token>` | Roční obnovení jedním kliknutím (odkaz chodí na univerzitní e-mail). |
| `/marketing/studenti` | Admin: Přehled (cíle a progress), Studenti (CRM), Fakulty (pokrytí, kontakty, oslovení), Cíle a nastavení, Metodika. |
| `src/supabase/functions/server/studentProgram.ts` | Edge logika (v `make-server-93a20b6f`). |
| `supabase/functions/_shared/student-program-faculties.ts` | Seznam fakult, domény, IČO, detekce univerzitního e-mailu. Sdílí web i server. |
| `supabase/migrations/20260903120000_student_program.sql`, `20260927120000_student_program_renewal.sql` | Tabulky `student_program_*`, RLS (staff čte, service_role píše), pg_cron `student-program-daily`, sloupce ročního obnovení. |
| `docs/STUDENT_PROGRAM.md` | Tenhle dokument. |

## Cesta studenta

1. **Registrace** — jméno, **univerzitní e-mail** (živá kontrola domény → univerzita a fakulta) a **osobní e-mail** (povinný, mimo univerzitu), volitelně telefon, obor, stupeň a předměty, souhlas, newsletter. `POST /student-program/register`.
2. **Ověření** — odkaz na univerzitní e-mail (platí 7 dní). `GET /student-program/verify?t=` → Kabinet založí studentovu organizaci a roční licenci, stav `active`, `access_valid_until` = dnes + 12 měsíců. Kódy jdou na oba e-maily, kontakt do `subscribers` (tag `student-program`, `studenti-<faculty>`), `access_token` pro self-service.
3. **Roční obnovení** (cron) — 30 dní před koncem přijde na univerzitní e-mail odkaz `/studenti/obnovit?t=<renewal_token>` (na osobní e-mail jen upozornění „mrkněte do univerzitní schránky“). Připomínky 7 dní před, v den konce a 14 dní po (`renewal_stage` 1–4). Kliknutí = `GET /student-program/renew` → další roční licence v Kabinetu, `renewal_count + 1`, stejné kódy.
4. **Bez obnovení** — 30 dní po konci (`renewalGraceDays`) stav `expired` + e-mail. Nová registrace vypršelého studenta stejným univerzitním e-mailem pošle rovnou obnovovací odkaz.
5. **Absolvent** — v `/studenti/aktualizace` nahlásí „dostudoval/a“ a školu (rejstřík škol). Stav `alumni`, přístup doběhne do konce zaplaceného roku, dál se neobnovuje. Známá škola → okamžité upozornění na `digestEmail` (lead pro obchod).

Stavy: `pending → active → (expired | alumni)`, vedlejší `declined` (ukončil studium), `unsubscribed`.

## Kódy: Kabinet (registr Ultra)

Každý student má **vlastní organizaci a vlastní kódy v Kabinetu**. Server volá hooky `https://qypiuvqglsmxdsnyazih.supabase.co/functions/v1/api/registr/hooks/web/*` s tajemstvím `KABINET_SECRET` (stejné jako u Edge funkce `kabinet-trial`; alternativně `REGISTR_MAKE_SECRET`), volitelně `KABINET_API_BASE`, `KABINET_ANON_KEY`.

| Krok | Hook | Parametry |
|---|---|---|
| Ověření | `POST /create-school` | `schoolName` = „Student Jméno Příjmení (Fakulta)“, `countryCode=cz`, `email` = univerzitní, `withFreeLicence=no` |
| Ověření + každé obnovení | `POST /create-subscription-licence` | `teacherCode`, `subjectName=['bundle']`, `startsOn`/`endsOn` (d/m/Y, +`licenceMonths`), `contentType=interactive`, `individual=yes` |

Proč ne `trial-request`: trial je měsíční, generuje zprávy do Pipedrive a má 180denní ochrannou lhůtu — nic z toho pro studenty nechceme. Roční „subscription“ licence zdarma je tichá a prodlužuje se přesně o rok. Individuální licence = přihlášení z jednoho zařízení najednou (brání sdílení kódů).

Selhání Kabinetu: student zůstává `active`, dostane e-mail „kódy pošleme zvlášť“, jde do fronty *Bez kódů* (nebo *Kódy bez roční licence*, když vznikla organizace, ale ne licence) a `digestEmail` dostane upozornění. V adminu: „Založit kódy (Kabinet)“, „Prodloužit o rok“, nebo ruční vložení kódů + „Poslat kódy znovu“.

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
2. Registrace testovacím univerzitním e-mailem + osobním e-mailem → ověřovací e-mail → kódy na oba e-maily. V Kabinetu (`/admin/kabinet`) musí být organizace „Student … (…)“ s roční licencí typu paid/individual.
3. V adminu u studenta „Poslat výzvu k obnovení“ → kliknout na odkaz → platnost se posune o rok, `renewal_count = 1`.
4. `POST /admin/student-program/run-cron?dryRun=1` → bez chyb.
5. 108 importovaných kontaktů: fronta *Importovaní z kontaktů* → „Pozvat“; import nemá osobní e-mail, ten si student doplní v aktualizaci (registrace ho vyžaduje, ověření pozvánky ne).
