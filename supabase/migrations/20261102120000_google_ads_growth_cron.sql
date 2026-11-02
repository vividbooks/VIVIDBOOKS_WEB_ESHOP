-- Google Ads: denní zjištění hledanosti a příprava návrhů reklam (neposílá nic do Google Ads,
-- zápis dělá až admin po schválení). Běží v 05:30 UTC (06:30/07:30 v Česku).
-- Hlavičku s tajemstvím přebíráme z fungujícího jobu, stejně jako u studentského programu.
DO $gads_cron$
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
    RAISE NOTICE 'google-ads-growth-daily: tajemství cronu nenalezeno, job se nezaložil';
    RETURN;
  END IF;
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'google-ads-growth-daily' LIMIT 1;
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;
  v_headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret, 'x-cron-secret', v_secret);
  PERFORM cron.schedule(
    'google-ads-growth-daily',
    '30 5 * * *',
    format($job$ select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb, timeout_milliseconds := 120000) $job$,
      'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/google-ads-growth',
      v_headers::text)
  );
END
$gads_cron$;
