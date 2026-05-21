-- Move shared extensions out of public schema and harden scheduled cron function invocations.

create schema if not exists extensions;

-- Move extensions to dedicated schema when currently in public.
DO $$
BEGIN
  -- pgvector
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector'
      AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_extension e
    WHERE e.extname = 'vector'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
  END IF;

  -- pg_net
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_net'
      AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_extension e
    WHERE e.extname = 'pg_net'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  END IF;
END $$;

GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA extensions TO postgres;

-- Rebuild worker jobs to avoid hardcoded, committed secrets.
create extension if not exists pg_cron schema extensions;

do $migration$
declare
  v_export_url text := coalesce(
    nullif(current_setting('app.process_export_queue_url', true), ''),
    'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/process-export-queue'
  );
  v_monitor_url text := coalesce(
    nullif(current_setting('app.monitor_order_workflows_url', true), ''),
    'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/monitor-order-workflows'
  );
  existing_job_id bigint;
  v_export_headers jsonb;
  v_monitor_headers jsonb;
begin
  select jobid
    into existing_job_id
    from cron.job
    where jobname = 'process-export-queue-every-minute'
    limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  v_export_headers := jsonb_strip_nulls(
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', nullif(current_setting('app.process_export_queue_cron_secret', true), '')
    )
  );

  perform cron.schedule(
    'process-export-queue-every-minute',
    '* * * * *',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      )
      $job$,
      v_export_url,
      v_export_headers::text
    )
  );

  select jobid
    into existing_job_id
    from cron.job
    where jobname = 'monitor-order-workflows-every-minute'
    limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  v_monitor_headers := jsonb_strip_nulls(
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', nullif(current_setting('app.monitor_order_workflows_cron_secret', true), '')
    )
  );

  perform cron.schedule(
    'monitor-order-workflows-every-minute',
    '* * * * *',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      )
      $job$,
      v_monitor_url,
      v_monitor_headers::text
    )
  );
end;
$migration$;
