-- RUČNÍ APLIKACE (není součástí automatických migrací).
-- Označí staré rozpracované platby jako zrušené, aby nemátily v adminu.
-- Před spuštěním zkontrolujte výběr (např. zúžit podle created_at nebo emailu).

update public.orders
set
  status = 'cancelled',
  cancelled_reason = 'Cleanup — duplicate test order',
  cancelled_at = now(),
  updated_at = now()
where status = 'pending_payment'
  and created_at < now() - interval '1 hour';

-- Volitelně: vrátit počet řádků v klientovi (psql: příkaz výše s RETURNING id).
