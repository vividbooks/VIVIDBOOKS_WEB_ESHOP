-- Studentský program: roční obnovení přes Kabinet (každý student vlastní organizace + roční licence).
-- Nahrazuje půlroční check-in: obnovovací odkaz chodí na univerzitní e-mail, kliknutí = ověření + nový rok.

ALTER TABLE public.student_program_students
  ADD COLUMN IF NOT EXISTS renewal_token TEXT,
  ADD COLUMN IF NOT EXISTS renewal_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS renewal_stage SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renewal_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legacy_admin_link TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_program_students_renewal_token
  ON public.student_program_students (renewal_token) WHERE renewal_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_program_students_access_valid
  ON public.student_program_students (access_valid_until) WHERE status = 'active';

COMMENT ON COLUMN public.student_program_students.renewal_stage IS
  '0 = nic, 1 = výzva 30 dní před koncem, 2 = 7 dní, 3 = v den konce, 4 = 14 dní po. Nuluje se obnovením.';
COMMENT ON COLUMN public.student_program_students.codes_valid_until IS
  'Konec roční licence v Kabinetu (create-subscription-licence). Obnovením se posune o další rok.';
COMMENT ON COLUMN public.student_program_students.access_valid_until IS
  'Nárok studenta = konec roční licence. Obnovuje se kliknutím na odkaz z univerzitního e-mailu.';
COMMENT ON COLUMN public.student_program_students.legacy_admin_link IS
  'Odkaz na organizaci studenta v legacy adminu (z create-school).';

-- Cron: tajemství z DB nastavení `app.mailing_cron_secret` chybí (mailing crony vrací 401),
-- proto job přebírá hlavičku z fungujícího jobu `webinar-reminders-every-ten-minutes`.
DO $student_cron_secret$
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
    RAISE NOTICE 'student-program-daily: tajemství cronu nenalezeno, job zůstává bez hlavičky';
    RETURN;
  END IF;
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'student-program-daily' LIMIT 1;
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;
  v_headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret, 'x-cron-secret', v_secret);
  PERFORM cron.schedule(
    'student-program-daily',
    '10 7 * * *',
    format($job$ select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb) $job$,
      'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/student-program',
      v_headers::text)
  );
END
$student_cron_secret$;
