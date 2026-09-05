# Průběhy (flows) DVPP zdarma

## 1 · Přihlášení magic linkem a první vstup

```mermaid
sequenceDiagram
  autonumber
  participant U as Učitel (prohlížeč)
  participant FE as dvppApi.ts
  participant E as Edge /dvpp/*
  participant DB as Postgres
  participant KV as KV
  participant M as Mandrill

  U->>FE: e-mail (+ jméno, souhlas, kód sborovny z /s/{code})
  FE->>E: POST /dvpp/auth/magic-link (+ UTM, vb_id)
  E->>DB: upsertSubscriber(status pending, source dvpp, tag dvpp-knihovna)
  E->>KV: dvpp_login_intent_{email} (next, newsletter, kód, UTM)
  E->>M: e-mail „Váš vstup do knihovny“ (token 24 h)
  E->>DB: funnel_events: lead
  E-->>FE: { ok, created }
  U->>FE: klik v e-mailu → /knihovna/prihlaseni?token=
  FE->>E: GET /dvpp/auth/verify?token=
  E->>DB: pending → subscribed (consent_version), dvpp_first_login_at
  E->>DB: dvpp_sessions (sha256 tokenu, 180 dní)
  E->>DB: škola z IČO / domény → subscribers.school_red_izo
  E->>DB: referrals: potvrdit vzkaz (hash e-mailu) → referred_by
  E->>DB: staffroom_members (kód z intentu / vzkazu)
  E->>DB: funnel_events: confirmed, school_linked, invite_confirmed
  E->>KV: smazat intent
  E-->>FE: { sessionToken, next, joined, me }
  FE->>FE: localStorage vividbooks_dvpp_session_v1
  FE-->>U: přesměrování na next (kvíz při prvním přihlášení)
```

## 2 · Sborovna: od prvního učitele k odemknutí

```mermaid
sequenceDiagram
  autonumber
  participant Z as Zakladatel
  participant K as Kolega
  participant E as Edge
  participant DB as Postgres

  Z->>E: PUT /dvpp/me (škola z našeptávače)
  Z->>E: POST /dvpp/staffroom
  E->>DB: staffrooms (code, target = f(teachers_count)), member via=founder (aktivní hned)
  E-->>Z: { code, shareUrl /s/{code} }
  Z->>K: sdílí odkaz sám (WhatsApp, Teams, QR, letáček) — POST /dvpp/staffroom/share (jen událost)
  K->>E: /s/{code} → GET /dvpp/staffroom/preview → magic link se staffroomCode
  K->>E: GET /dvpp/auth/verify → member via=code, referred_by = zakladatel
  E->>DB: funnel_events: invite_confirmed → recountOne()
  K->>E: POST /dvpp/progress (≥ 180 s) → activated_at → recountOne()
  Note over E,DB: confirmed = subscribed ∧ (aktivovaný ∨ founder/director)
  E->>DB: confirmed ≥ target → status unlocked, unlocked_by milestone, schools.milestone_reached_at
  E->>DB: funnel_events: staffroom_unlocked
  Note over Z,K: Odměny cestou: 1 aktivovaný kolega → zakladatel má full přístup (resolveAccess)
```

Pokles pod milník (odhlášení kolegy): cron `recountOne` → `grace` (30 dní), pak `expired`. Ředitelské, zákaznické a ruční odemknutí (`unlocked_by`) se nepřepočítává.

## 3 · Vzkaz kolegovi (režim WP29)

```mermaid
sequenceDiagram
  participant Z as Zakladatel
  participant E as Edge
  participant DB as Postgres
  participant M as Mandrill
  participant K as Kolega

  Z->>E: POST /dvpp/staffroom/message { email, message }
  E->>DB: limity: 10/den na odesílatele, stejný hash 30 dní, alias → review_flag
  E->>DB: referrals (invitee_email, hash, token, status sent)
  E->>M: 1 e-mail jménem zakladatele, bez marketingu, bez odměny
  E->>DB: funnel_events: invite_sent
  K->>E: klik → /s/{code}?r={token} → magic link → verify
  E->>DB: referrals.status confirmed, invitee_email = null, referred_by
  Note over E,DB: cron: sent starší 14 dnů → expired, invitee_email = null
```

## 4 · Záznam, aktivace, certifikát

```mermaid
sequenceDiagram
  participant U as Učitel
  participant FE as Přehrávač /zaznam/{slug}
  participant E as Edge
  participant KV as KV (dotazník)
  participant DB as Postgres

  U->>FE: otevře záznam
  FE->>E: GET /dvpp/catalog → locked? (guest / starter limit)
  FE->>E: POST /dvpp/progress každých 30 s
  E->>DB: dvpp_progress; první zápis → funnel play; 180 s → activateMember
  U->>FE: „Získat osvědčení“ → existující DVPP dotazník (WebinarPostSurvey)
  FE->>E: POST /webinar-survey-submit (stávající) → KV webinar_survey_{id}_{md5}
  FE->>E: POST /dvpp/certificate { webinarId, title, hours, lecturer }
  E->>KV: existuje dokončený dotazník?
  E->>DB: certificates (number VB-DVPP-…), funnel certificate, activateMember
  FE->>FE: PDF z webinarCertificateDocument.ts (stejné číslo)
  U->>FE: police certifikátů v /knihovna (GET /dvpp/certificates)
```

## 5 · Ředitel a školní kód

```mermaid
flowchart TD
  A[Ředitel dostane e-mail / dopis se školním kódem nebo přijde na /pro-reditele] --> B[magic link, pozice Ředitel/ka]
  B --> C[PUT /dvpp/me: škola z rejstříku]
  C --> D[POST /dvpp/staffroom/director-unlock]
  D --> E[staffrooms: unlocked, unlocked_by = director]
  E --> F[Ředitel rozešle kód sborovně sám — legálně čistá cesta]
  F --> G[Učitelé: /s/kód → magic link → členové]
  E --> H[GET /dvpp/staffroom/report: hodiny DVPP sboru pro výroční zprávu / šablony]
```

## 6 · Měření: co se kam posílá

```mermaid
flowchart LR
  B[Prohlížeč: visit, trailer_play, klik na sdílení] -->|POST /dvpp/events + UTM + vb_id| E[recordFunnelEvent]
  S[Server: lead, confirmed, play, certificate, invite_*, staffroom_*] --> E
  E --> FE[(funnel_events)]
  E -.hash e-mailu, IP, UA.-> META[Meta Conversions API]
  E -.client_id = vb_id.-> GA[GA4 Measurement Protocol]
  FE --> D[/admin/dvpp/dashboard: KPI strom, kohorty, pokrytí škol/]
```

Dedup s browser pixelem: stejný `eventId` v `/dvpp/events` a ve `fbq('track', …, {}, { eventID })`.

## 7 · Cron a údržba

| Úloha | Kdy | Co dělá |
|---|---|---|
| `POST /cron/dvpp-recount` | denně 03:00 | přepočet sboroven (grace/expired), úklid vzkazů > 14 dnů, dopárování 300 kontaktů podle domény |
| `POST /admin/dvpp/schools/import` | po nahrání nového CSV rejstříku | upsert `schools` |
| `POST /admin/mailing/recompute-subject-interests` (existující) | týdně | zájmy o předměty → řádek „Doporučeno“ |

## 8 · Automatizace (spouštěče v `automation_flows`)

| Spouštěč | Kdy se má volat | Doporučená sekvence |
|---|---|---|
| `dvpp_confirmed` | po `verify` prvního přihlášení | D0 vítejte + první certifikát za 45 min · D2 nedokončený záznam · D5 pozvěte kolegu |
| `dvpp_certificate` | po vystavení | D0 PDF + „kolegům se bude hodit“ · D3 další díl řady |
| `dvpp_referral_confirmed` | kolega potvrdil | zakladateli „přibyl vám kolega, chybí N“ |
| `dvpp_staffroom_unlocked` | milník | celé sborovně „máte knihovnu zdarma“ |

Zapojení do `enrollInFlows` je další krok (viz CHANGELOG); typy jsou v `automationEngine.ts` už připravené.
