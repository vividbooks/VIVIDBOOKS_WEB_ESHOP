-- Hlídač produkční databáze Vividbooks Ultra: každou minutu zavolat
-- /cron/ultra-watchdog na tomto projektu (Edge routa ověřuje tajemství
-- ULTRA_WATCHDOG_CRON_SECRET). Tajemství se čte z DB settingu
-- app.ultra_watchdog_secret (nastaveno ručně: alter database postgres set
-- app.ultra_watchdog_secret = '…'; stejná hodnota je Edge secret).
-- Pozn.: mailing cron (mailing-send-every-minute) běží bez Authorization
-- hlavičky a dostává 401 — jeho tajemství se proto nedalo převzít.
do $watchdog$
declare
  v_secret text := nullif(current_setting('app.ultra_watchdog_secret', true), '');
  v_url text := 'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/ultra-watchdog';
  existing_job_id bigint;
  v_headers jsonb;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron není nainstalován — job ultra-watchdog-every-minute přeskočen.';
    return;
  end if;
  if v_secret is null then
    raise notice 'app.ultra_watchdog_secret není nastaven — job ultra-watchdog-every-minute přeskočen.';
    return;
  end if;

  select jobid into existing_job_id from cron.job where jobname = 'ultra-watchdog-every-minute' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_secret,
    'x-cron-secret', v_secret
  );

  perform cron.schedule(
    'ultra-watchdog-every-minute',
    '* * * * *',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      )
      $job$,
      v_url,
      v_headers::text
    )
  );
end;
$watchdog$;
