# Changelog stavby DVPP zdarma

Stav podle kroků z kapitoly 11 strategie. ✅ hotovo v repu · 🔧 rozpracováno · ⏳ čeká.

## 2026-09-05 (večer) · řady na landing page, kapitoly a upoutávky, digest

### ✅
- `DvppSeriesShowcase` na landing dvppzdarma.cz: řady, nejsledovanější, tři argumenty, hlasování (bez přihlášení, z `/dvpp/catalog`).
- Kapitoly u záznamů (`chapters`, „mm:ss Název“) s klikem na čas v přehrávači (`seekTo` přes ref) a zvýrazněním aktuální kapitoly; upoutávka (`trailerUrl`) se hraje nepřihlášeným místo prvních 10 minut.
- Admin `/marketing/dvpp` má záložky: Přehled (KPI, údržba, CSV velikostí sborů, sborovny) · Záznamy (délka, lektor, upoutávka, kapitoly, předměty, datum přidání) · Řady (CRUD s výběrem dílů) · Témata (hlasování).
- Digest „Nové v knihovně“: `POST /admin/dvpp/digest/draft` složí e-mail (nové záznamy, řady, naživo tento týden, hlasování, blok sborovny) a uloží ho jako draft do EmailBuilderu; odesílá se ručně jako kampaň.
- `dvpp/content.ts` (čistá logika: kapitoly, výběr nových záznamů, subject digestu) + 2 testy.

## 2026-09-05 (odpoledne) · sekvence, cron, přehrávač, landing

### ✅
- `dvpp/automations.ts`: čtyři hotové e-mailové sekvence (uvítání D0/D2/D5, po osvědčení D0/D3, přibyl kolega, sborovna odemčena) v brand šabloně; seed přes existující `flows/seed-defaults`; spouštění z `verify`, `issueCertificate`, `joinByCode`, `recountOne`.
- Migrace `20260905110000_schedule_dvpp_recount_cron.sql`: denní pg_cron na `/cron/dvpp-recount`.
- `POST /admin/dvpp/schools/import-sizes`: CSV s počty žáků/učitelů → `schools`, přepočet milníků sboroven ve stavu `building`.
- Přehrávač `DvppYouTubePlayer` (YouTube IFrame API): přesná pozice každých 30 s, dokončení při 90 %, **upoutávka pro nepřihlášené: prvních 10 minut** bez přihlášení, pak výzva (událost `preview_limit`).
- Landing `DvppLeadMagnetPage`: karty vedou do `/knihovna/zaznam/:id`, hero má CTA „Otevřít knihovnu“ a „Pro ředitele“, text bez „akreditované“.
- `webinar-survey-light-lead` nově zapisuje do `subscribers` (source `dvpp`) + škola a událost.
- Texty: „akreditované DVPP“ nahrazeno „s osvědčením DVPP“ (SEO stránky, `llms.txt`); PDF certifikát cituje § 10 vyhlášky 317/2005 Sb.

## 2026-09-05 · Krok 1–4 backend, dokumentace

### ✅ Datový model
- Migrace `20260905100000_dvpp_lead_magnet_core.sql`: `schools`, `subscribers.{school_red_izo, teacher_type, referred_by, dvpp_profile, dvpp_first/last_login_at}`, `dvpp_sessions`, `staffrooms`, `staffroom_members`, `referrals`, `certificates`, `dvpp_progress`, `content_topics`, `content_votes`, `funnel_events`, enum `subscriber_source` + `dvpp`, RLS (staff SELECT, service_role ALL), 6 výchozích témat k hlasování.

### ✅ Edge moduly `src/supabase/functions/server/dvpp/`
- `milestones.ts` čistá logika (milník 4/8/12/16, odhad sboru, doména, přepočet stavu, přístup, kód, typ učitele) + 6 testů v `scripts/run-unit-tests.ts`.
- `schools.ts` import rejstříku z CSV cache do tabulky, hledání (RED_IZO / IČO / doména), párování kontaktu, stav školy, zpětné dopárování, souhrn pokrytí.
- `events.ts` `funnel_events` + Meta CAPI + GA4 MP (volitelné secrets), souhrn pro dashboard.
- `auth.ts` magic link (token purpose `dvpp-login`, 24 h), session (sha256, 180 dní), double opt-in v jednom kroku.
- `staffroom.ts` založení, kód, členství, aktivace, přepočet, ochranná lhůta, ředitelské odemknutí, vzkaz kolegovi (WP29), potvrzení vzkazu, cron.
- `catalog.ts` řádky Pokračovat / Doporučeno / Řady / Nejsledovanější / Témata, zámky podle přístupu, progress.
- `certificates.ts` evidence osvědčení (číslo shodné s PDF), kontrola dotazníku, výkaz pro ředitele.
- `votes.ts` témata a hlasy.
- `emails.ts` login, vzkaz kolegovi, milník (brand šablona).
- `hooks.ts` napojení na `/webinar-registrace` a `/dvpp-video-registrace` (škola + událost).
- `routes.ts` 30 endpointů, registrace v `index.tsx` před `Deno.serve`; `/admin/dvpp/*` v JWT guardu.

### ✅ Frontend
- `src/utils/dvppApi.ts` typovaný klient, session v localStorage, UTM capture.
- `src/components/dvpp/`: `DvppRoot` (session provider jako layout routa), `DvppShell` (rám, navigace, tlačítka), `DvppLoginPage` (/knihovna/prihlaseni: magic link + ověření tokenu), `DvppLibraryPage` (/knihovna: řádky, police certifikátů, hlasování), `DvppPlayerPage` (/knihovna/zaznam/:id: přehrávač, progress po 30 s, zámek, osvědčení), `DvppStaffroomPage` (/sborovna: milník, členové, sdílení, vzkaz kolegovi, ředitelské odemknutí), `SchoolPicker` (našeptávač nad `schools`), `DvppJoinPage` (/s/:code), `DvppDirectorsPage` (/pro-reditele: školní kód, výkaz DVPP), `DvppQuizPage` (/kviz: 8 otázek → typ učitele), `DvppLeafletPage` (/sborovna/letacek: A4 s QR k tisku).
- Admin `src/components/admin/DvppDashboardPage.tsx` na `/marketing/dvpp` (KPI, pokrytí, sborovny, import rejstříku, dopárování) + položka v menu Marketing.
- Routy v `src/routes.ts` pod `Root` (bez katalogového layoutu, fungují i na dvppzdarma.cz). `vite build` prochází.

### ✅ Dokumentace
- `docs/dvpp/README.md`, `DATOVY_MODEL.md`, `API.md`, `FLOWS.md`, tento changelog.

### ⏳ Čeká (další kroky)
- Upoutávky natočit/sestříhat (obsahová práce): 20 nejlepších záznamů, 45–90 s, nahrát na YouTube a vložit do metadat.
- Digest: personalizovaný blok sborovny (stav školy per příjemce) vyžaduje merge pole v kampani; dnes je blok obecný.
- Import velikosti sboru (statistika MŠMT) — dnes odhad z počtu žáků, pokud CSV rejstříku nese `pupils`/`teachers`; jinak 8 jako výchozí milník.
- Upoutávky a kapitoly u záznamů (pole `trailerUrl`, `durationMinutes` v KV videí).
- Secrets pro Meta CAPI / GA4; kontrola doručitelnosti (DKIM/DMARC, Seznam FBL) před spuštěním digestu.

### Známé kompromisy
- Osvědčení za záznam se váže na existující DVPP dotazník (`webinar_survey_*` v KV); záznamy bez párovaného webináře zatím certifikát nevystaví (`409`).
- `teachers_count` je odhad, dokud se nenahraje statistika; admin může opravit ručně.
- Session je token v localStorage (ne cookie), protože Edge funkce běží na jiné doméně než web.
