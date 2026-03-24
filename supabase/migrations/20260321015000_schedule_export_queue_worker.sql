create extension if not exists pg_cron;
create extension if not exists pg_net;

do $migration$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'process-export-queue-every-minute'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'process-export-queue-every-minute',
    '* * * * *',
    $job$
      select net.http_post(
        url := 'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/process-export-queue',
        headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlla2t1bmRnaXp6ZGJta3phdGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjYwMDIsImV4cCI6MjA4OTUwMjAwMn0.PsD7gEnhCushlJwnCkFIwfrGLws0KFa0QsCb54_6WHk","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlla2t1bmRnaXp6ZGJta3phdGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjYwMDIsImV4cCI6MjA4OTUwMjAwMn0.PsD7gEnhCushlJwnCkFIwfrGLws0KFa0QsCb54_6WHk"}'::jsonb,
        body := '{}'::jsonb
      );
    $job$
  );
end;
$migration$;
