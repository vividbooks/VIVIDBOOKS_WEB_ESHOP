-- Marketing snapshot: denní pull agregátů z Ultra (05:45 UTC).
DO $msnap_cron$
DECLARE
  v_cmd TEXT;
  v_secret TEXT;
  v_job BIGINT;
  v_headers JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN RETURN; END IF;
  SELECT command INTO v_cmd FROM cron.job WHERE jobname = 'webinar-reminders-every-ten-minutes' LIMIT 1;
  v_secret := substring(v_cmd FROM '"x-cron-secret": ?"([^"]+)"');
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'marketing-snapshot-daily: tajemství cronu nenalezeno, job se nezaložil';
    RETURN;
  END IF;
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'marketing-snapshot-daily' LIMIT 1;
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;
  v_headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret, 'x-cron-secret', v_secret);
  PERFORM cron.schedule(
    'marketing-snapshot-daily',
    '45 5 * * *',
    format($job$ select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb, timeout_milliseconds := 120000) $job$,
      'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/marketing-snapshot',
      v_headers::text)
  );
END
$msnap_cron$;
