# API DVPP zdarma

Základ: `https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f` (v prohlížeči přes `edgeFunctionBase()`).
Každá routa existuje i bez prefixu funkce (interní mount). Klient: [`src/utils/dvppApi.ts`](../../src/utils/dvppApi.ts). Server: [`src/supabase/functions/server/dvpp/routes.ts`](../../src/supabase/functions/server/dvpp/routes.ts).

Hlavičky:

| Hlavička | Kdo | Kdy |
|---|---|---|
| `Authorization: Bearer <anon>` | všichni | vždy |
| `X-Dvpp-Session: <token>` | přihlášený učitel | routy označené 🔐 |
| `X-User-Access-Token: <staff JWT>` | admin | `/admin/dvpp/*` (guard `isMailingAdminPath`) |
| `X-Cron-Secret: <MAILING_CRON_SECRET>` | pg_cron | `/cron/dvpp-*` |

Chyby: `{ error: string, code?: string }` s HTTP 4xx/5xx. `401 { code: 'unauthenticated' }` = session chybí nebo vypršela; klient token zahodí.

## Přihlášení

### `POST /dvpp/auth/magic-link`
```json
{ "email": "jana@zsmilovice.cz", "name": "Jana Nováková", "next": "/knihovna", "newsletter": true,
  "staffroomCode": "K7PX4M", "source": "fb", "medium": "post", "campaign": "upoutavka-fyzika", "sessionKey": "<vb_id>" }
```
→ `{ ok: true, created: boolean }`. Kontakt se založí jako `pending` (source `dvpp`, tag `dvpp-knihovna`), pošle se e-mail s odkazem `/knihovna/prihlaseni?token=…` (platí 24 h). Událost `lead`.

### `GET /dvpp/auth/verify?token=`
→ `{ ok, sessionToken, next, firstLogin, joined: { code, schoolName } | null, me }`.
Potvrdí kontakt (`pending → subscribed`; `unsubscribed → subscribed` jen s `newsletter: true`), založí session (180 dní), spáruje školu (IČO / doména), potvrdí případný vzkaz kolegovi, přidá do sborovny podle kódu. Událost `confirmed`, případně `school_linked`, `invite_confirmed`.

### `POST /dvpp/auth/logout` 🔐 → `{ ok }`

## Profil

### `GET /dvpp/me`
→ `{ me: Me | null, access? }`
```ts
type Me = {
  id, email, firstName, lastName, position, isDirector, teacherType,
  profile: Record<string, unknown>, profileDone: boolean,
  school: { redIzo, name, city, teachersCount } | null,
  access: { level: 'guest'|'starter'|'full', starterUsed, starterLimit, reason, staffroomStatus },
  status,
}
```

### `PUT /dvpp/me` 🔐
```json
{ "firstName": "Jana", "lastName": "Nováková", "position": "Učitel/ka na ZŠ",
  "redIzo": "600051234", "ico": "70990123",
  "profile": { "subjects": ["fyzika","matematika"], "stages": ["2"], "role": "ucitel",
               "dvpp_hours_need": "8-16", "pain_point": "motivace", "style": "objevovani", "decides": "reditel" } }
```
→ `{ ok, me }`. `profile` se slučuje do `dvpp_profile`, doplní `completed_at`, spočítá `teacher_type`. Události `profile_done`, `school_linked`.

### `GET /dvpp/schools/search?q=`
→ `{ results: [{ redIzo, ico, name, city, type, isPrimary, teachersCount }] }` (max 12, ZŠ první).

## Knihovna

### `GET /dvpp/catalog` (session volitelná)
→
```ts
{
  rows: [{ key: 'continue'|'recommended'|'series:{id}'|'top'|'topic:{slug}', title, subtitle?, videos: Video[] }],
  series: Series[], topics: Topic[], access: Access, me: Me | null
}
type Video = { id, name, slug, thumbnail, youtubeUrl, topicIds, description, subjects, locked,
               progress: { position, duration, completed, updatedAt } | null,
               certificate: { number, issuedAt } | null, plays30d,
               certificateLinkMode, webinarSlugForSurvey }
```
`locked`: host vždy; starter po vyčerpání 3 záznamů (rozkoukané zůstávají otevřené); full nikdy.

### `POST /dvpp/progress` 🔐
`{ videoId, position, duration?, completed? }` → `{ ok, activated }`. První zápis = událost `play`; překročení 180 s poprvé = aktivace člena sborovny (počítá se do milníku). Starter nad limit → `403 { code: 'starter_limit' }`.

## Certifikáty

### `GET /dvpp/certificates` 🔐 → `{ certificates: Certificate[] }`

### `POST /dvpp/certificate` 🔐
`{ kind?: 'dvpp'|'feedback', webinarId?, videoId?, title, hours?, lecturer?, holderName? }` → `{ ok, certificate, created }`.
`dvpp` vyžaduje dokončený DVPP dotazník k programu (KV `webinar_survey_{webinarId}_{md5(email)}`), jinak `409`. Číslo `VB-DVPP-{rok}-{6}` je stejné jako v PDF. Událost `certificate`, aktivace člena.

## Sborovna

### `GET /dvpp/staffroom` 🔐
→ `{ school, staffroom: { code, status, target, confirmed, graceUntil, unlockedBy, unlockedAt } | null, members: [{ firstName, lastInitial, activated, via, joinedAt, isMe }], confirmed, target, missing, myReferred, shareUrl, colleaguesInBase }`

### `POST /dvpp/staffroom` 🔐 → `{ ok, created, code, shareUrl }` — založí sborovnu školy z profilu (zakladatel se počítá hned).

### `POST /dvpp/staffroom/share` 🔐 `{ channel: 'copy'|'whatsapp'|'messenger'|'email'|'qr'|'print' }` → událost `invite_shared`.

### `GET /dvpp/staffroom/preview?code=` (veřejné)
→ `{ code, status, confirmed, target, school: { name, city } | null, founderFirstName }` — pro stránku `/s/{code}` před přihlášením.

### `POST /dvpp/staffroom/join` 🔐 `{ code }` → `{ ok, added, school: { name }, status, confirmed, target }`. Událost `invite_confirmed`, přepočet.

### `POST /dvpp/staffroom/message` 🔐 `{ email, message }` → `{ ok }`
„Vzkaz kolegovi“ (WP29): jedna zpráva jménem odesílatele, bez marketingu, bez připomínky, limit 10/den, dedupe 30 dní, adresa se maže po 14 dnech. `429` limit, `409` duplicita.

### `POST /dvpp/staffroom/director-unlock` 🔐 → `{ ok, code, status }` — jen pozice ředitel/zástupce (`isDirectorPosition`), škola z profilu. Událost `director_unlock`.

### `GET /dvpp/staffroom/report?since=` 🔐 (vedení školy)
→ `{ teachers: [{ name, email, certificates, hours }], totalHours, totalCertificates }`

## Hlasování

### `GET /dvpp/topics` → `{ topics: [{ id, title, description, subjects, status, votes_count, myVote? }] }`
### `POST /dvpp/vote` 🔐 `{ topicId }` → `{ ok, voted, votes }` (přepínač)

## Měření

### `POST /dvpp/events`
`{ event: 'visit'|'trailer_play'|'preview_limit'|…, meta?, eventId?, email?, source?, medium?, campaign?, content?, sessionKey? }` → `{ ok }`
Zapíše do `funnel_events`, kopie do Meta CAPI a GA4 (pokud jsou secrets). `eventId` slouží k deduplikaci s browser pixelem.

## Cron

### `POST /cron/dvpp-recount` (X-Cron-Secret)
→ `{ ok, recounted, cleanedReferrals, backfill: { scanned, linked } }` — přepočet všech sboroven, úklid vzkazů po 14 dnech, dopárování 300 kontaktů podle domény. Spouštět 1× denně.

## Admin (`/admin/dvpp/*`, staff JWT)

| Metoda | Cesta | Co dělá |
|---|---|---|
| POST | `/admin/dvpp/schools/import` | naplní `schools` z CSV rejstříku v Storage (`loadSchoolsCache`) → `{ upserted, skipped, withTeachers, total }` |
| POST | `/admin/dvpp/schools/backfill` `{ limit? }` | dopáruje kontakty bez školy podle domény |
| POST | `/admin/dvpp/schools/import-sizes` (tělo = CSV) | velikost sboru: sloupce `red_izo`/`ico`, `zaci`/`pupils`, `ucitele`/`teachers`; přepočítá milníky dosud neodemčených sboroven |
| GET | `/admin/dvpp/schools?status=&q=` | seznam ZŠ (300) s velikostí, stavem, doménou |
| PUT | `/admin/dvpp/schools/:redIzo` | `status_reason`, `status_note`, `teachers_count` (nastaví `teachers_estimated=false`), `domain`, `email`, `director_name` |
| GET | `/admin/dvpp/dashboard?days=` | `{ funnel: { byEvent, byDay }, coverage: { byStatus, primarySchools, schoolsWithContacts, staffrooms }, subscribers: { active, withSchool }, certificates }` |
| GET | `/admin/dvpp/staffrooms?status=` | sborovny se školou |
| POST | `/admin/dvpp/staffrooms/:redIzo/unlock` | ruční odemknutí (unlocked_by = manual) |
| POST | `/admin/dvpp/staffrooms/:redIzo/recount` | přepočet jedné sborovny |
| GET / PUT | `/admin/dvpp/series` | řady v KV `{ series: [...] }` |
| PUT | `/admin/dvpp/topics` | založit/upravit téma k hlasování |

## Napojení na existující endpointy

- `POST /webinar-registrace` → po dual-write do `subscribers` volá `dvpp/hooks.afterRegistration` (škola z IČO/domény, událost `webinar_registered`, členství ve sborovně školy, pokud existuje).
- `POST /dvpp-video-registrace` → totéž s událostí `lead` (`meta.via = recording | recording-light`).
- `GET /dvpp-videos` zůstává zdrojem záznamů; `/dvpp/catalog` ho obaluje.
