# Fonty pro hero slider (CMS)

Do této složky vložte soubory (názvy musí odpovídat `@font-face` v `src/styles/globals.css`):

| Font | Soubory (stačí jeden formát) |
|------|------------------------------|
| **Visby Round CF Demi Bold** | `VisbyRoundCF-DemiBold.woff2` nebo `VisbyRoundCF-DemiBold.otf` nebo `Visby-Round-CF-Demi-Bold.otf` |
| **Vividbooks Script One** | `VividbooksScriptOne-Regular.woff2` nebo `VividbooksScriptOne-Regular.ttf` |

**Fenomen Sans Semi Bold** je už načtený z úložiště (Supabase) v `globals.css` — nic sem nedávejte.

Po přidání souborů restartujte dev server (`npm run dev`), aby se cesty `/fonts/...` načetly.
