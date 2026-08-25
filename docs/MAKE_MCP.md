# Make.com MCP — připojení pro Cursor a jiné MCP klienty

Make MCP server zpřístupní AI klientovi (Cursor, Claude, ChatGPT) dvě skupiny nástrojů:

- **spouštění scénářů** — každý **aktivní** scénář s plánováním **on demand** se stane volatelným nástrojem (dostupné ve všech plánech),
- **management** — čtení a úpravy scénářů, připojení, webhooků, data stores, týmů a organizací (jen platené plány).

Dokumentace Make: [Make MCP Server](https://developers.make.com/mcp-server/make-mcp-server).

> Pozor na názvy: Edge funkce **`make-server-93a20b6f`** v tomto repu s Make.com nesouvisí (jde o pojmenování z Figma Make). Make.com MCP je vývojářský nástroj, ne součást runtime webu.

---

## Co už je v repu hotové

| Soubor | Role |
|--------|------|
| [`.cursor/mcp.json`](../.cursor/mcp.json) | Registrace serveru `make` pro Cursor (OAuth URL `https://mcp.make.com`). Sdílené s celým týmem přes git. |
| [`scripts/check-make-mcp.mjs`](../scripts/check-make-mcp.mjs) | Kontrola spojení — `npm run mcp:make:check`. |
| [`scripts/make-mcp-client.mjs`](../scripts/make-mcp-client.mjs) | Minimalistický MCP klient (Streamable HTTP), pokrytý unit testy v `npm test`. |

Žádný token v repu není a nikdy tam nepatří — viz [Bezpečnost](#bezpečnost).

---

## Varianta A — OAuth (doporučeno pro Cursor Desktop)

Konfigurace už v repu je, takže stačí přihlášení:

1. V Cursoru otevři **Settings → Tools & Integrations** (na Free plánu **Tools**).
2. V **MCP Tools** se objeví server **make** se stavem **Needs login** — klikni na něj.
3. V dialogu **Open** → otevře se souhlasná obrazovka Make.
4. Vyber **organizaci** a **scopes** (minimálně *Run your scenarios*; management nástroje vyžadují další scopes).
5. **Allow** → **Open Cursor**.

OAuth je per‑uživatel: každý člen týmu se přihlásí ke své organizaci, v repu nejsou žádné klíče.

Kdo pracuje mimo tento repozitář, může server přidat i jednorázovým odkazem:
`cursor://anysphere.cursor-deeplink/mcp/install?name=make&config=eyJ1cmwiOiJodHRwczovL21jcC5tYWtlLmNvbSJ9`

Timeouty přes `https://mcp.make.com`: **25 s** pro spuštění scénáře, **30 s** pro management nástroje.

## Varianta B — MCP token (delší timeouty, CLI, headless)

1. V Make klikni vpravo nahoře na své jméno → **Profile** → záložka **API access**.
2. **Tokens → Add token**, vyber scopes:
   - `mcp:use` — zpřístupní scénáře jako nástroje,
   - `scenarios:read` — umožní dotáhnout výsledek scénáře, který přeběhl timeout (vrací se `executionId`),
   - management scopes podle toho, co má klient smět měnit.
3. Pojmenuj token (**Label**) a potvrď **Add**.

Připojení s tokenem v hlavičce (Cursor umí interpolaci `${env:…}`, takže token zůstává mimo repo):

```json
{
  "mcpServers": {
    "make": {
      "url": "https://eu2.make.com/mcp/stateless",
      "headers": {
        "Authorization": "Bearer ${env:MAKE_MCP_TOKEN}"
      }
    }
  }
}
```

- `eu2.make.com` nahraď svou zónou (`MAKE_ZONE`) — najdeš ji v URL administrace Make.
- `/stateless` je výchozí Streamable HTTP; při problémech se spojením lze použít `/stream`, případně `/sse`.
- Timeouty s tokenem: **40 s** pro scénáře, **60 s** pro management (`/stateless`).

Klienti, kteří hlavičky neumí, mohou dát token přímo do cesty: `https://<MAKE_ZONE>/mcp/u/<MCP_TOKEN>/stateless`.

### Omezení, které scénáře jsou vidět

Token bez parametrů dá AI přístup ke **všem** aktivním on‑demand scénářům ve všech organizacích. Zúžení se dělá query parametry na URL s tokenem (úrovně nelze kombinovat):

```
?organizationId=<id>
?teamId=<id>
?scenarioId[]=<id1>&scenarioId[]=<id2>
```

Podrobnosti: [Scenarios as tools access control](https://developers.make.com/mcp-server/connect-using-mcp-token/scenarios-as-tools-access-control).

---

## Cursor Cloud Agents

`.cursor/mcp.json` z repozitáře platí pro Cursor Desktop / IDE, **ne** pro cloud agenty. Pro ně se server registruje mimo repo:

- osobní: **cursor.com/agents** → dropdown MCP,
- týmový: **Dashboard → Integrations & MCP → Team MCP Servers**.

Použij **HTTP** transport (`https://<MAKE_ZONE>/mcp/stateless` + hlavička `Authorization`), případně OAuth. `SSE` ani `mcp-remote` cloud agenti nepodporují. Hlavičky a OAuth secrets jsou v dashboardu šifrované a po uložení je nikdo nepřečte.

---

## Kontrola spojení

```bash
npm run mcp:make:check                                     # OAuth URL z .cursor/mcp.json
MAKE_ZONE=eu2.make.com MAKE_MCP_TOKEN=… npm run mcp:make:check
node scripts/check-make-mcp.mjs --url https://eu2.make.com/mcp/stateless --tools 50
```

Skript udělá `initialize` → `notifications/initialized` → `tools/list` a vypíše nalezené nástroje. Exit kódy:

| Kód | Význam |
|-----|--------|
| `0` | Handshake i výpis nástrojů prošly. |
| `2` | Server odpovídá, ale chybí autorizace (HTTP 401/403) — typické bez tokenu, kdy se přihlašuje až klient přes OAuth. |
| `1` | Jiná chyba (nedostupný endpoint, špatná URL, timeout). |

Priorita zdrojů endpointu: `--url` → `MAKE_MCP_URL` → `MAKE_ZONE` + `MAKE_MCP_TOKEN` → URL z `.cursor/mcp.json` → `https://mcp.make.com`. Token se posílá jen v hlavičce a ve výpisu se maskuje.

Skript testuje POST transporty (`--transport stateless|stream`); `/sse` má jiný handshake, tak ho záměrně nepodporuje.

---

## Bezpečnost

- MCP token je klíč k Make účtu v rozsahu svých scopes — **nikdy** ho necommituj. Patří do `.env` (v `.gitignore`), do shell profilu, nebo do MCP konfigurace v Cursor dashboardu.
- Dávej tokenu jen scopes, které klient potřebuje; pro spouštění scénářů stačí `mcp:use` (+ `scenarios:read` pro výsledky po timeoutu).
- Scénář se stane nástrojem jen když je **aktivní** a má plánování **on demand** — pro řízení rozsahu je jednodušší nechat citlivé scénáře mimo tento režim než se spoléhat na prompt.
- Popisy scénářů a jejich [inputs/outputs](https://help.make.com/scenario-inputs-and-outputs) zásadně zvyšují spolehlivost volání z AI.

---

## Odkazy

- [Make MCP Server](https://developers.make.com/mcp-server/make-mcp-server) — transporty, URL, timeouty
- [Connect using OAuth](https://developers.make.com/mcp-server/connect-using-oauth) · [Usage with Cursor](https://developers.make.com/mcp-server/connect-using-oauth/usage-with-cursor)
- [Connect using MCP token](https://developers.make.com/mcp-server/connect-using-mcp-token) · [Usage with Cursor](https://developers.make.com/mcp-server/connect-using-mcp-token/usage-with-cursor)
- [Make Skills](https://skills.make.com/) — doporučené instrukční soubory pro AI asistenty pracující s Make
