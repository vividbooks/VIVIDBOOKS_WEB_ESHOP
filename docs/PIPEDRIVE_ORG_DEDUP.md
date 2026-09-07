# Zakládání organizací v Pipedrive — audit a pravidla proti duplicitám

Stav k 7. 9. 2026. Zdroje: kód v tomhle repu, blueprinty Make scénářů, produkční
data Pipedrive (1 300 nejnovějších organizací, 10/2024 – 09/2026).

## 1. Kde se organizace v Pipedrive zakládá

### 1.1 Tenhle repozitář (edge funkce `make-server-93a20b6f`)

V celém repu je **jediné** místo, které volá `POST /organizations`:
`upsertPipedriveSchoolOrganization()` v `src/supabase/functions/server/index.tsx`.
Všechny toky jdou přes ni:

| Tok | Volající | IČO | Přesná shoda názvu |
|---|---|---|---|
| Objednávka z e‑shopu (B2B i distributor) | `syncEshopOrderToPipedrive` | z objednávky | ano |
| Školní poptávka / objednávka na fakturu | `syncSchoolOrderToPipedrive` | `customer.ico` / `customer.vat` | ano |
| Trial 2.0 (`/vyzkousejte`, oba scénáře) | `syncTrialPipedriveDeal` | z formuláře | ano |
| Trial — dohrání polí osoby | `handleTrialPersonFieldsEndpoint` | z formuláře | ano |
| Registrace na webinář | `syncWebinarRegistrationToPipedrive` | z formuláře | ano |
| Admin: „ensure school“ | `/admin/pipedrive/ensure-school` | z těla requestu | ne (fuzzy) |
| Admin: ruční deal | `/admin/pipedrive/deals` | z těla requestu | ne (fuzzy) |

Ostatní edge funkce (`pipedrive-inbound-deal`, `make-server-954b19ad`) organizace
jen **čtou** — žádná z nich nezakládá.

### 1.2 Make (mimo tento repozitář)

Organizaci zakládá i **23 aktivních Make scénářů** (team `Vividbooks / My Team`),
mimo jiné české `[CZ1] Order form v1.1` (775989), `[CZ1] Trial form v1.8` (775986)
a `v1.8 [Migrated]` (6775847), `[CZ1] Webinar form v1.5` (775979),
`[APP] Upsell – create deal` (2226488). Všechny mají stejný tvar:

```
itemSearch(field = CIN 4033, term = {{Vat}} syrové z formuláře, exact_match)
   ├─ nalezeno → použij organizaci
   └─ nenalezeno → CreateOrganization (CIN = {{Vat}} syrové)
```

Tenhle repozitář je na ně **nemá vliv**. Jejich slabiny jsou stejné jako
ty, které řeší část 3, plus jedna navíc: po větvi „create“ scénáře zakládají
aktivitu **„Activity: Merge organizace“** — tedy vzniklou duplicitu už dnes
řeší ručním sloučením.

## 2. Co v produkčních datech skutečně vzniklo

Vzorek 1 300 organizací (10/2024 – 09/2026), pole CIN (org field 4033):

- **11 skupin sdílí stejný CIN** (33 organizací), z toho 13 organizací má CIN `0`.
- **10 skupin má identický název** a různý / chybějící CIN.
- **62 hodnot CIN není číslo** (`Doplň IČO`, `zanetasaldova@gmail.com`, `Jana Krocova`, `test`).
- **43 hodnot nemá 8 číslic** (`0`, `9999`, `1981`, `606030263`, `6198998967`).
- **33 osmiciferných hodnot neprojde kontrolním součtem** — překlepy.
- `#39739` má v CIN `CZ45238782` (DIČ) — vyhledání podle `45238782` ji nenajde.

Konkrétní duplicity a jejich příčiny:

| Duplicita | Příčina |
|---|---|
| `#39822` + `#39823` „KRPŠ při ZŠ Hustopeče nad Bečvou“ — **stejný název i stejný CIN `01228251`**, obojí 24. 6. 2026 | Zpoždění vyhledávacího indexu Pipedrive: druhý požadavek organizaci od prvního ještě neviděl. |
| `#39879` (41498835) + `#39912` (49418835) „ZŠ U Červených domků Hodonín“ | Překlep v IČO — **obě hodnoty mají vadný kontrolní součet**. Shoda podle CIN selhala, název se nezkoušel. |
| `#39845` (62990361) + `#39848` (62390661) „VOŠ, SŠ, ZŠ, MŠ Štefánikova 549“ | Totéž. |
| `#39900` (741651) + `#39901` (754654) „ZŠ a MŠ Sudoměřice u Bechyně“ | Totéž, navíc špatná délka IČO. |
| `#39767` (bez CIN) + `#39770` (71004645) „MŠ Zeleneč“ | Existující organizace CIN vyplněný nemá → strict režim ji přeskočil a založil novou. |
| `#39760` (9999) + `#39835` (06069185) „Ninjabot“ | Výplň v poli IČO se chovala jako platný identifikátor. |

Naopak `#39707` (75016346) a `#39972` (606030263) „ZŠ, Skuteč, Komenského 150“
jsou **legitimně dvě organizace** stejného názvu — tady se sloučit nesmí.

## 3. Pravidla, která teď kód dodržuje

Pořadí hledání v `lookupSchoolInPipedrive` — organizace se zakládá až když
selže všechno předchozí:

1. **Trvalý rejstřík IČO → orgId** (`pipedriveOrgRegistry.ts`, KV tabulka).
   Přemostí zpoždění search indexu; zápis proběhne hned po `POST /organizations`.
2. **Vyhledání podle CIN** — přes normalizované IČO, včetně varianty s vedoucími
   nulami, a **s ověřením proti skutečné hodnotě pole CIN** (`GET /organizations/{id}`).
   Bez ověření stačilo, aby se číslo trefilo do jiného textového pole organizace.
3. **Vyhledání podle názvu** — běží **i pro zákaznické formuláře**. Nález se
   převezme, pokud organizace CIN nemá (většina starší báze), má shodný, nebo
   pokud IČO z formuláře neprojde kontrolním součtem (překlep). Nepřevezme se,
   když má organizace **jiné platné** IČO — to jsou opravdu dvě různé školy.
   U zákaznických formulářů musí být shoda názvu **přesná**; fuzzy „obsahuje“
   a fallback na první výsledek zůstávají jen adminům.

Doplňková pravidla:

- **Normalizace IČO** (`_shared/pipedrive-org-ico.ts`): `CZ45238782`, `123 456 78`
  i `12345678` vedou na tutéž organizaci. Výplně (`0`, `9999`, text bez číslic)
  se zahodí a chovají se jako „IČO nezadáno“.
- **Kontrolní součet** rozhoduje jen o důvěře, ne o odmítnutí formuláře.
- **CIN se do existující organizace doplní, když chybí** — tím se škola napříště
  najde rovnou podle IČO. Existující hodnota se nikdy nepřepisuje.
- **Atomický claim na IČO** před založením (insert na primární klíč KV). Souběžné
  požadavky téže školy projdou jen jednou; ostatní počkají a organizaci převezmou.

## 4. Přepnutí Make scénářů na společný endpoint

Aby pravidla z části 3 platila i pro Make, má server endpoint

```
POST /make-server-93a20b6f/pipedrive/resolve-organization
hlavička: x-vividbooks-secret = PIPEDRIVE_ORG_RESOLVE_SECRET
parametry (query nebo JSON tělo): ico, schoolName, address
odpověď: { orgId, orgName, ownerId, matchedBy, created, ico, status }
```

Bez nastaveného `PIPEDRIVE_ORG_RESOLVE_SECRET` vrací 503 — endpoint zakládá
záznamy v CRM, takže se nesmí omylem vystavit veřejně. Parametry se čtou z query
stringu i z JSON těla; Make posílá query, protože si ho sám URL‑enkóduje a
apostrof v názvu školy tak nic nerozbije.

Ve scénáři se mění **jeden modul**: „Search organization“ (`pipedrive:MakeAPICall`
nad `itemSearch`) se nahradí `http:ActionSendData` na tenhle endpoint. Odkazy na
jeho výstup se přepíšou:

| původní | nové |
|---|---|
| `{{N.body.data.items[].item.id}}` | `{{N.data.orgId}}` |
| `{{N.body.data.items[].item.name}}` | `{{N.data.orgName}}` |
| `{{N.body.data.items[].item.owner.id}}` | `{{N.data.ownerId}}` |

Modul dostane error handler `builtin:Resume`: když endpoint selže, scénář
nespadne, výstup zůstane prázdný a projde se **původní záložní větev**
„Create new organization“. Registrace se tím nikdy neztratí a větev zůstává
v scénáři jako pojistka (přejmenovaná, ať je zřejmé, že to není běžná cesta).

Úpravu generuje `scripts/make/patch_pipedrive_org_lookup.py` — mapování vstupních
polí pro každý scénář je v konstantě `SCENARIOS`. Blueprint se do Make nahrává
přes **Import Blueprint** v menu scénáře; přes Make API to nejde, blueprinty
těchhle scénářů mají přes 500 kB. Tajemství je ve vygenerovaném souboru jen jako
placeholder `__DOPLNIT_PIPEDRIVE_ORG_RESOLVE_SECRET__` — doplňuje se až v Make.

**Pořadí nasazení je závazné:** nejdřív nastavit `PIPEDRIVE_ORG_RESOLVE_SECRET`
a nasadit `make-server-93a20b6f`, teprve pak importovat blueprint. Opačně by
scénář volal endpoint, který ještě neexistuje (a spolehl by se na záložní větev).

Stav přepnutí:

| Scénář | Stav |
|---|---|
| 3472524 `[CZ1] Webinar form v1.5 (úpravy a testování)` | blueprint vygenerovaný, čeká na import a ověření |
| ostatních 11 CZ/SK | čeká na potvrzení vzoru |
| 11 zahraničních (AR, CL, CO, MX, PY, UY, ES, ESP, EN) | zatím beze změny — kontrolní součet IČO je česko‑slovenský |

## 5. Co zbývá

- **Historické duplicity** (část 2) tenhle kód nesloučí — je to jednorázový úklid
  v Pipedrive; přednostně 11 skupin se sdíleným CIN.
- **Sanitace pole CIN** u 105 organizací s nečíselnou / krátkou hodnotou.
