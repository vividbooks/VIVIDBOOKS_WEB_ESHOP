create extension if not exists pg_cron;
create extension if not exists pg_net;

do $migration$
declare
  existing_job_id bigint;
  v_url text := coalesce(
    nullif(current_setting('app.process_export_queue_url', true), ''),
    'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/process-export-queue'
  );
  v_headers jsonb;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'process-export-queue-every-minute'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  v_headers := jsonb_strip_nulls(
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', nullif(current_setting('app.process_export_queue_cron_secret', true), '')
    )
  );

  perform cron.schedule(
    'process-export-queue-every-minute',
    '* * * * *',
    $job$
      select net.http_post(
        url := v_url,
        headers := v_headers,
        body := '{}'::jsonb
      );
    $job$
  );
end;
$migration$;
