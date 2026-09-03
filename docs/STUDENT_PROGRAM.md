# Studentský program — studenti učitelství

Cíl: dostat Vividbooks ke studentům pedagogických fakult (a dalších fakult s učitelstvím) tak, aby do škol přicházeli jako uživatelé, kteří materiály znají, tvoří si v aplikaci vlastní přípravy a přinesou je do svých sboroven.

| Kde | Co |
|---|---|
| `/studenti` | Microsite: registrace univerzitním e-mailem, ověření odkazem, kódy. `?f=<faculty-id>` předvyplní fakultu (odkaz pro fakulty), `?t=<token>` = ověření. |
| `/studenti/aktualizace?t=<access_token>` | Self-service: „ještě studuji / dostudoval jsem / kam nastupuji“, telefon, osobní e-mail, používání, zpětná vazba. |
| `/marketing/studenti` | Admin: Přehled (cíle a progress), Studenti (CRM), Fakulty (pokrytí, kontakty, oslovení), Cíle a nastavení, Metodika. |
| `src/supabase/functions/server/studentProgram.ts` | Edge logika (v `make-server-93a20b6f`). |
| `supabase/functions/_shared/student-program-faculties.ts` | Seznam fakult, domény, IČO, detekce univerzitního e-mailu. Sdílí web i server. |
| `supabase/migrations/20260903120000_student_program.sql` | Tabulky `student_program_*`, RLS (staff čte, service_role píše), pg_cron `student-program-daily`. |
| `docs/STUDENT_PROGRAM.md` | Tenhle dokument. |

## Cesta studenta

1. **Registrace** — jméno, univerzitní e-mail (živá kontrola domény → univerzita a výběr fakulty), osobní e-mail, telefon (nepovinně), obor, stupeň + předměty, předpokládaný konec studia (měsíc/rok), souhlas, newsletter. `POST /student-program/register`.
2. **Ověření** — e-mail s odkazem (platí 7 dní). `GET /student-program/verify?t=` → stav `active`, kódy fakulty, uvítací e-mail (kopie na osobní e-mail), zápis do `subscribers` (tag `student-program`, `studenti-<faculty>`), `access_token` pro self-service.
3. **Check-in každých 182 dní** (cron) — e-mail s odkazem na aktualizaci. Odpověď nastaví `last_response_at`, `uses_in_practice`, `engagement` (`active` / `passive`); dvě nezodpovězené výzvy → `inactive`.
4. **Konec studia** (`expected_graduation` ≤ dnes) — stav `graduating`, jednorázový e-mail „kam nastupujete“ (hledání školy v rejstříku škol přes `/school-search`). Student nahlásí `graduated` → stav `alumni`; známá škola → okamžité upozornění na `digestEmail` (lead pro obchod).
5. **Vypršení** — `access_valid_until` = konec studia + 6 měsíců (nebo ruční `access_extended_until`). Po datu stav `expired` + e-mail s nabídkou školního trialu.

Stavy: `pending → active → graduating → alumni → expired`, vedlejší `declined` (ukončil studium), `unsubscribed`.

## Kódy a legacy admin

Aplikace stále rozhoduje o přístupu podle kódů školy z legacy Vividbooks (`api.vividbooks.com`). Program pracuje s principem **jedna fakulta = jedna „škola“ v legacy adminu**:

- První ověřený student fakulty zavolá `free-trial-ajax` (Position `Student`, Whence `studenti`, School = „<fakulta> – studenti“, Vat = IČO univerzity). Vrácené kódy se uloží k fakultě (`teacher_code`, `student_code`, `codes_valid_until` = +14 dní) a dostane je každý další student bez dalšího volání.
- **Obchod pak v legacy adminu prodlouží platnost** (ideálně na celý akademický rok) a zapíše datum do „Platí do“ u fakulty. Cron 21 dní před koncem upozorní v denním digestu.
- Kódy lze vložit ručně (bez volání API) — nastavení `autoIssueCodes = false` nebo vyplnění u fakulty předem.
- Režim `per_student` (každý student vlastní trial) je v nastavení pro případ, že by legacy API se sdílenou „školou“ nefungovalo. **Ověřit s prvními registracemi** — chování legacy API pro opakované registrace na stejné IČO není z tohoto repozitáře vidět.

Student bez kódů (legacy chyba) zůstává `active`, dostane e-mail „kódy pošleme zvlášť“ a padá do fronty *Bez kódů* + okamžité upozornění na `digestEmail`. Po doplnění kódů u fakulty stačí „Poslat kódy znovu“.

## Měřitelné cíle (admin → Cíle)

| Cíl | Výchozí | Jak se měří |
|---|---|---|
| Aktivní studenti | 300 do 30. 6. 2027 | stav `active` / `graduating` / `alumni` |
| Pokrytí PedF | 9 / 9 | fakulta typu `pedf` s ≥ 1 aktivním studentem |
| Partnerské fakulty | 5 | `outreach_status = partner` (oficiální rozeslání nebo workshop) |
| Používá Vividbooks | 50 % | `uses_in_practice = true` z těch, kdo odpověděli na check-in |
| Absolventi se známou školou | 60 % | `employer_school_name/ico` u `alumni` + `expired` |

Denní digest (`digestEmail`, výchozí vitek@vividbooks.com): nové registrace, ověření, odpovědi na check-in, fakulty k prodloužení, studenti bez kódů.

## Fakulty a oslovení

Seznam: 9 pedagogických fakult (jádro) + fakulty s učitelskými programy (MFF, PřF, FF, FTVS, FPF SU, FHS UTB, IVP ČZU, …). U každé: odhad studentů učitelství (editovatelný), stav oslovení, garant, follow-up, vzorky, workshop, kontakty (proděkan pro studium, vedoucí kateder didaktiky, studijní oddělení).

Šablony jménem Vítka (`renderOutreachTemplate`): úvod vedení fakulty, úvod katedře (vzorky sešitů zdarma + workshop), připomenutí, text pro studenty k přeposlání. Odesílá se **jen po kliknutí** v adminu přes Mandrill (from hello@vividbooks.com, Reply-To vitek@vividbooks.com); zapisuje `last_contacted_at`, follow-up +12 dní, událost.

## Provoz

- **Cron** `student-program-daily` (07:10 UTC) → `POST /cron/student-program`, secret `MAILING_CRON_SECRET` (stejný jako mailing). Ručně z adminu: „Denní běh nasucho / naostro“.
- **Deploy**: migrace přes Supabase (push/`supabase db push`), Edge funkce `make-server-93a20b6f` se nasadí workflow po změně `src/supabase/functions/server/**`. Frontend push do `main`.
- **Secrets**: nic nového — Mandrill, service role, `MAILING_CRON_SECRET`. Volitelně `LEGACY_VIVIDBOOKS_WEB_API_BASE` (default `https://api.vividbooks.com`).
- **RLS**: tabulky čte jen staff (`is_staff_email()`), zapisuje service_role přes Edge.
- **Redirecty**: `/cs/studenti` a `/cs/studenti-ucitelstvi/*` → `/studenti`; externí přesměrování `/studenti` na starý web zrušeno.

## Co ověřit po nasazení

1. Registrace testovacím univerzitním e-mailem → ověřovací e-mail → kódy. Zkontrolovat v legacy adminu, jak vznikla „škola“ fakulty a prodloužit ji.
2. Druhý student ze stejné fakulty → musí dostat stejné kódy bez volání API (`legacy_result = faculty_codes`).
3. `POST /admin/student-program/run-cron?dryRun=1` → bez chyb.
4. `/marketing/studenti` → Přehled načte data, Fakulty jsou naplněné (seed proběhne automaticky při prvním čtení).
