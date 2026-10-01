-- pg_cron: DVPP zdarma — denní přepočet sboroven (ochranná lhůta, expirace), úklid vzkazů kolegům
-- po 14 dnech a dopárování kontaktů podle školní domény. Endpoint: POST /cron/dvpp-recount.
-- Secret sdílí s mailingem: app.mailing_cron_secret (viz supabase/manual/set_mailing_cron.sql, pokud existuje);
-- bez nastaveného secretu se úloha naplánuje a endpoint vrátí 401 — pak nastavte
--   alter database postgres set app.mailing_cron_secret = '<MAILING_CRON_SECRET>';
-- a migraci spusťte znovu (nebo úlohu přeplánujte ručně).

do $migration$
declare
  v_url text := coalesce(
    nullif(current_setting('app.dvpp_recount_url', true), ''),
    'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/dvpp-recount'
  );
  v_secret text := nullif(current_setting('app.mailing_cron_secret', true), '');
  existing_job_id bigint;
  v_headers jsonb;
begin
  select jobid into existing_job_id from cron.job where jobname = 'dvpp-recount-daily' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  v_headers := jsonb_strip_nulls(jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', case when v_secret is not null then 'Bearer ' || v_secret else null end,
    'x-cron-secret', v_secret
  ));

  perform cron.schedule(
    'dvpp-recount-daily',
    '15 3 * * *',
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
$migration$;
