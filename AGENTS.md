# AGENTS.md

Projektová dokumentace: [`docs/PROJECT.md`](docs/PROJECT.md) (struktura repa, Edge funkce, proměnné) a [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (nasazení, Stripe). Rychlé spuštění je v [`README.md`](README.md).

## Cursor Cloud specific instructions

Tato sekce je pro budoucí cloud agenty. Update script (`npm install`) už proběhl při startu VM, takže neopakuj instalaci závislostí.

### Co je tento repozitář
- Jeden npm balíček v kořeni: **Vite + React** frontend (e‑shop / marketing web Vividbooks). Node 22, `package-lock.json` → používej **npm**.
- „Backend" jsou **Supabase Edge Functions** (Deno) — **neběží lokálně**. Frontend volá **živý** Supabase projekt natvrdo v [`src/utils/supabase/info.tsx`](src/utils/supabase/info.tsx). Není tu žádná lokální DB/server, kterou by šlo spustit; není potřeba `.env` pro rozběhnutí dev serveru.
- Podsložka [`VIVIDASISTANT/`](VIVIDASISTANT/) je samostatná aplikace s vlastním `package-lock.json` (asistent). Root `npm install` ji nepokrývá — pokud na ní pracuješ, instaluj závislosti zvlášť v té složce.

### Standardní příkazy (skripty v `package.json`)
- Dev server: `npm run dev` — Vite na portu **3000** (`server.open: true`, v headless prostředí jen vypíše hint, nic neblokuje).
- Testy: `npm test` — lehké unit testy přes `tsx` (`scripts/run-unit-tests.ts`), žádný externí test runner.
- Build: `npm run build` — výstup do `build/`.
- **Lint/typecheck neexistuje**: v repu není ESLint konfigurace ani `tsconfig.json` a v `package.json` není `lint` skript. Nevymýšlej `npm run lint`.

### Netriviální poznámky pro vývoj
- Košík je čistě klientský: `localStorage` klíč **`vividbooks_cart_v1`** (viz [`src/contexts/CartContext.tsx`](src/contexts/CartContext.tsx)); checkout (`/pokladna`) z něj čte. Ceny (`unitPrice`) jsou v **haléřích** (např. `19900` = 199,00 Kč).
- Katalog produktů se načítá z živého backendu a **může být prázdný** (v konzoli se pak objeví `ProductContext fetch failed`). To je stav produkčních dat, ne chyba prostředí. Pokud potřebuješ vyzkoušet košík/checkout end‑to‑end bez objednatelných produktů, naseeduj položku do `localStorage` (klíč výše) a otevři `/pokladna?step=cart`.
- Routy jsou lazy‑loaded (React Router). Při „studeném" dev serveru může první načtení route krátce spadnout na blank / `Failed to fetch dynamically imported module` — pomůže **jeden hard reload** té URL.
- Katalog je na `/katalog` (ne `/obchod`); akce/balíčky na `/akce`.
