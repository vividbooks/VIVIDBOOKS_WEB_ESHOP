-- Sledování poslední změny řádku fronty (claim → processing, retry, …) pro obnovu po timeoutu Edge workeru.
alter table public.export_queue
  add column if not exists updated_at timestamptz not null default now();

update public.export_queue
set updated_at = created_at
where updated_at is null;

drop trigger if exists tr_export_queue_set_updated_at on public.export_queue;
create trigger tr_export_queue_set_updated_at
  before update on public.export_queue
  for each row
  execute function public.set_row_updated_at();

comment on column public.export_queue.updated_at is 'Poslední změna řádku (vč. claim processing) — pro release zaseknutého processing po timeoutu workeru.';
