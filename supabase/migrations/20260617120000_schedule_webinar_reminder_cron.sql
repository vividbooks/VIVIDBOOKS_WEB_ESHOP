-- pg_cron: automatické připomínky webinářů (ráno „Dnes“ + ~30 min před startem „Za chvíli“).
-- Secret a URL nastavte stejně jako u process-export-queue (viz supabase/manual/set_webinar_reminder_cron.sql).

do $migration$
declare
  v_url text := coalesce(
    nullif(current_setting('app.webinar_reminder_url', true), ''),
    'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/webinar-reminders'
  );
  existing_job_id bigint;
  v_headers jsonb;
begin
  select jobid
    into existing_job_id
    from cron.job
    where jobname = 'webinar-reminders-every-ten-minutes'
    limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  v_headers := jsonb_strip_nulls(
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', case
        when nullif(current_setting('app.webinar_reminder_cron_secret', true), '') is not null
        then 'Bearer ' || current_setting('app.webinar_reminder_cron_secret', true)
        else null
      end,
      'x-cron-secret', nullif(current_setting('app.webinar_reminder_cron_secret', true), '')
    )
  );

  perform cron.schedule(
    'webinar-reminders-every-ten-minutes',
    '*/10 * * * *',
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
