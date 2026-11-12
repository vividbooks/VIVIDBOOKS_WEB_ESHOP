# distributor-auto · PR3 e-shop (povinná doručovací adresa + přepínač Pipedrive)

Karta: t_12fbd56c · spec: kritéria 13 a 11, §9a (Hermes `Projekty/vividbooks/docs/linka-novy-vyvoj/distributor-auto/spec.md`)

## Hotovo
- [x] Testy z kritérií napsané první: `src/supabase/functions/server/distributorOrder_test.ts` (bez zapojení do handleru/stránky 2 testy padají).
- [x] Sdílená logika `src/utils/distributorDelivery.ts` (validace adresy, localStorage podle IČO, adresa sídla, přepínač).
- [x] Server `POST /distributor/orders`: bez/nevalidní `delivery` → 400 česky; uloží `orders.delivery_*`; firma příjemce do `order_events.order_created.details.delivery.company` (sloupec není, bez migrace).
- [x] Přepínač `kv_store_33b2092f` `distributor_pipedrive_sync` (chybí = zapnuto). `false` → bez Pipedrive a Kabinetu, `order_events` `pipedrive_skipped`, `pipedrive_sync_status` zůstane NULL.
- [x] Potvrzení na stránce i v e-mailu bez věty „Ozve se vám obchodní zástupce“ jen při `false`; e-mail ukazuje doručovací adresu.
- [x] Formulář: sekce „Doručovací adresa“, předvyplnění poslední adresy z localStorage, jinak firma z IČO + tlačítko „Použít adresu sídla“.

## Ověření
- `deno test --node-modules-dir=none --allow-read --allow-env src/supabase/functions/server/distributorOrder_test.ts` → 13 ok.
- `vite build` ok, `tsc --noEmit` bez nových chyb, `deno check` index.tsx bez nových chyb v dotčených místech.

## Zbývá (mimo tento PR)
- Klíč `distributor_pipedrive_sync` se nezakládá – přepne se až při zapnutí automatu (CRM `on` → e-shop `false`).
- PR2 (CRM worker) čte adresu z `orders.delivery_*`, firmu příjemce z `order_events` (`order_created.details.delivery.company`), jinak `school_name`.
