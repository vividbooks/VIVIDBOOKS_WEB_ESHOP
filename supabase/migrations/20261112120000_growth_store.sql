-- Generické KV úložiště pro growth moduly (náhrada KV store, aby šla data joinovat a zálohovat).
create table if not exists public.growth_store (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

alter table public.growth_store enable row level security;
-- Žádné anon policy → jen service role.
