-- Omezí čtení marketingových tabulek na e-maily v admin_staff_emails (stejný význam jako admin allowlist).
-- Kontrola přes SECURITY DEFINER funkci — tabulku admin_staff_emails nemusí číst přímo authenticated role.

create table if not exists public.admin_staff_emails (
  email text primary key not null
);

insert into public.admin_staff_emails (email) values
  ('vitek@vividbooks.com'),
  ('dan@vividbooks.com')
on conflict (email) do nothing;

alter table public.admin_staff_emails enable row level security;

-- Pouze service role spravuje seznam (Dashboard / migrace).
revoke all on public.admin_staff_emails from authenticated;
grant select on public.admin_staff_emails to service_role;

create or replace function public.is_staff_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_staff_emails a
    where lower(a.email) = lower(auth.email())
  );
$$;

grant execute on function public.is_staff_email() to authenticated;

-- Nahrazení politik „SELECT pro každého authenticated“
do $pol$
declare
  t text;
begin
  for t in select unnest(array[
    'lists', 'subscribers', 'tags', 'subscriber_tags', 'subscriber_lists',
    'campaigns', 'email_links', 'email_events', 'automation_flows', 'automation_enrollments'
  ])
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_staff_email())',
      t || '_select_staff',
      t
    );
  end loop;
end
$pol$;
