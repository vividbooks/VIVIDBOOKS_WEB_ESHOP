# Fonty pro hero slider (CMS)

## Co je už na Supabase (bucket **Admin math**, veřejné)

- **Vividbooks Script One** — `VividbooksScriptOne-Regular.ttf` (načítá se z URL v `globals.css`, lokální soubor je volitelný).
- **Visby Round CF Demi Bold** — nahrajte do bucketu přesně jako **`VisbyRoundCF-DemiBold.otf`** (stejný název jako v `globals.css`). Dokud tam není, zobrazí se **Fenomen Sans Semi Bold** jako záloha.

## Volitelně lokálně (`/public/fonts/`)

Názvy musí odpovídat `@font-face` v `src/styles/globals.css`:

| Font | Soubory (stačí jeden formát) |
|------|------------------------------|
| **Visby Round CF Demi Bold** | `VisbyRoundCF-DemiBold.woff2` nebo `VisbyRoundCF-DemiBold.otf` nebo `Visby-Round-CF-Demi-Bold.otf` |
| **Vividbooks Script One** | `VividbooksScriptOne-Regular.woff2` nebo `VividbooksScriptOne-Regular.ttf` |

**Fenomen Sans** a **Cooper Light** jsou jen z Supabase — nic sem nedávejte.

Po přidání lokálních souborů restartujte dev server (`npm run dev`).
