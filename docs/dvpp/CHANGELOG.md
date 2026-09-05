# Changelog stavby DVPP zdarma

Stav podle kroků z kapitoly 11 strategie. ✅ hotovo v repu · 🔧 rozpracováno · ⏳ čeká.

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

### ✅ Frontend základ
- `src/utils/dvppApi.ts` typovaný klient, session v localStorage, UTM capture.

### ✅ Dokumentace
- `docs/dvpp/README.md`, `DATOVY_MODEL.md`, `API.md`, `FLOWS.md`, tento changelog.

### ⏳ Čeká (další kroky)
- Frontend stránky: `/knihovna` (řádky, přehrávač s progressem, police certifikátů), `/knihovna/prihlaseni`, `/sborovna`, `/s/:code`, `/pro-reditele`, `/kviz`, nová landing dvppzdarma.cz, admin `/marketing/dvpp`.
- Zapojení `enrollInFlows` pro spouštěče `dvpp_*` a obsah čtyř sekvencí (Resend automatizace).
- Import velikosti sboru (statistika MŠMT) — dnes odhad z počtu žáků, pokud CSV rejstříku nese `pupils`/`teachers`; jinak 8 jako výchozí milník.
- Upoutávky a kapitoly u záznamů (pole `trailerUrl`, `durationMinutes` v KV videí).
- pg_cron pro `/cron/dvpp-recount`, secrets pro Meta CAPI / GA4.
- Odstranit „akreditované“ z SEO textů a `llms.txt`, doplnit odkaz na § 10 vyhl. 317/2005 do PDF certifikátu.

### Známé kompromisy
- Osvědčení za záznam se váže na existující DVPP dotazník (`webinar_survey_*` v KV); záznamy bez párovaného webináře zatím certifikát nevystaví (`409`).
- `teachers_count` je odhad, dokud se nenahraje statistika; admin může opravit ručně.
- Session je token v localStorage (ne cookie), protože Edge funkce běží na jiné doméně než web.
