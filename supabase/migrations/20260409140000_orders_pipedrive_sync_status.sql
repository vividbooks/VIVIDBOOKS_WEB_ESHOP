-- Sledování ručního / serverového syncu dealu do Pipedrive (eshop).
alter table public.orders
  add column if not exists pipedrive_sync_status text
    check (
      pipedrive_sync_status is null
      or pipedrive_sync_status in ('pending', 'done', 'failed')
    );

alter table public.orders
  add column if not exists pipedrive_sync_error text;

alter table public.orders
  add column if not exists pipedrive_synced_at timestamptz;

comment on column public.orders.pipedrive_sync_status is 'pending | done | failed — stav posledního pokusu o vytvoření dealu (eshop)';
comment on column public.orders.pipedrive_sync_error is 'Poslední chybová hláška při syncu do Pipedrive';
comment on column public.orders.pipedrive_synced_at is 'Čas úspěšného vytvoření dealu v Pipedrive';
