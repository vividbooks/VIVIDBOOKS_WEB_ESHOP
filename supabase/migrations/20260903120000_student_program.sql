-- Studentský program Vividbooks (studenti učitelství, /studenti + admin /marketing/studenti).
--
-- Čtyři tabulky: fakulty (pokrytí + oslovení), kontakty na fakultách, studenti (CRM
-- se stavem přístupu) a události. Čtení: staff (is_staff_email), zápis: service_role
-- přes Edge funkci make-server-93a20b6f. Seznam fakult se plní ze sdíleného souboru
-- supabase/functions/_shared/student-program-faculties.ts (endpoint seed), ne odsud.

-- ── fakulty ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_program_faculties (
  id TEXT PRIMARY KEY,
  university TEXT NOT NULL,
  university_short TEXT NOT NULL,
  faculty TEXT NOT NULL,
  faculty_short TEXT NOT NULL,
  city TEXT,
  region TEXT,
  ico TEXT,
  email_domains TEXT[] NOT NULL DEFAULT '{}'::text[],
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('pedf', 'other')),
  website TEXT,
  estimated_students INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- oslovení fakulty (vedení, katedry)
  outreach_status TEXT NOT NULL DEFAULT 'not_contacted'
    CHECK (outreach_status IN ('not_contacted', 'contacted', 'in_talks', 'partner', 'declined')),
  outreach_owner TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  samples_sent_at TIMESTAMPTZ,
  workshop_at TIMESTAMPTZ,
  notes TEXT,
  -- přístupové kódy fakulty (jedna „škola“ v legacy Vividbooks adminu = jedna fakulta)
  teacher_code TEXT,
  student_code TEXT,
  codes_source TEXT CHECK (codes_source IS NULL OR codes_source IN ('legacy_trial', 'manual')),
  codes_issued_at TIMESTAMPTZ,
  codes_valid_until DATE,
  codes_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.student_program_faculties.codes_valid_until IS
  'Do kdy platí kódy fakulty v legacy adminu. Prodlužuje obchod; cron hlídá blížící se konec.';

CREATE INDEX IF NOT EXISTS idx_student_program_faculties_kind ON public.student_program_faculties (kind);
CREATE INDEX IF NOT EXISTS idx_student_program_faculties_outreach ON public.student_program_faculties (outreach_status);

COMMENT ON TABLE public.student_program_faculties IS
  'Fakulty připravující učitele. Seed ze sdíleného TS seznamu; pole oslovení edituje admin.';

-- ── kontakty na fakultách ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_program_faculty_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id TEXT NOT NULL REFERENCES public.student_program_faculties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  department TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'replied', 'partner', 'declined')),
  last_contacted_at TIMESTAMPTZ,
  last_reply_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_program_faculty_contacts_faculty
  ON public.student_program_faculty_contacts (faculty_id);

-- ── studenti ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_program_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_email TEXT NOT NULL
    CHECK (char_length(university_email) > 3 AND university_email = lower(trim(university_email))),
  personal_email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  faculty_id TEXT REFERENCES public.student_program_faculties(id) ON DELETE SET NULL,
  study_programme TEXT,
  subjects TEXT[] NOT NULL DEFAULT '{}'::text[],
  school_stages TEXT[] NOT NULL DEFAULT '{}'::text[],
  expected_graduation DATE,
  -- životní cyklus přístupu
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'graduating', 'alumni', 'expired', 'declined', 'unsubscribed')),
  verification_token TEXT,
  verification_sent_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  access_token TEXT,
  -- kódy z legacy Vividbooks (free-trial API)
  teacher_code TEXT,
  student_code TEXT,
  codes_issued_at TIMESTAMPTZ,
  legacy_result TEXT,
  legacy_reason TEXT,
  access_valid_until DATE,
  access_extended_until DATE,
  -- půlroční check-in
  next_checkin_at TIMESTAMPTZ,
  last_checkin_sent_at TIMESTAMPTZ,
  checkin_count INTEGER NOT NULL DEFAULT 0,
  last_response_at TIMESTAMPTZ,
  engagement TEXT NOT NULL DEFAULT 'unknown'
    CHECK (engagement IN ('unknown', 'active', 'passive', 'inactive')),
  uses_in_practice BOOLEAN,
  last_self_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- po škole
  employer_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (employer_status IN ('unknown', 'teaching', 'not_teaching', 'studying_further')),
  employer_school_name TEXT,
  employer_school_ico TEXT,
  -- souhlasy a původ
  consent_terms BOOLEAN NOT NULL DEFAULT false,
  newsletter BOOLEAN NOT NULL DEFAULT false,
  source TEXT,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  subscriber_id UUID REFERENCES public.subscribers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_program_students_university_email_key UNIQUE (university_email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_program_students_verification_token
  ON public.student_program_students (verification_token) WHERE verification_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_program_students_access_token
  ON public.student_program_students (access_token) WHERE access_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_program_students_status ON public.student_program_students (status);
CREATE INDEX IF NOT EXISTS idx_student_program_students_faculty ON public.student_program_students (faculty_id);
CREATE INDEX IF NOT EXISTS idx_student_program_students_next_checkin
  ON public.student_program_students (next_checkin_at) WHERE next_checkin_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_program_students_graduation
  ON public.student_program_students (expected_graduation);
CREATE INDEX IF NOT EXISTS idx_student_program_students_personal_email
  ON public.student_program_students (lower(personal_email)) WHERE personal_email IS NOT NULL;

COMMENT ON TABLE public.student_program_students IS
  'Studenti učitelství s přístupem zdarma. Klíč = univerzitní e-mail (lower/trim).';
COMMENT ON COLUMN public.student_program_students.access_valid_until IS
  'Konec studia + 6 měsíců. Skutečnou platnost kódů určuje legacy admin (access_extended_until).';
COMMENT ON COLUMN public.student_program_students.access_extended_until IS
  'Ruční prodloužení nad rámec konce studia + 6 měsíců (např. doktorand, přerušení).';

-- ── události ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_program_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id UUID REFERENCES public.student_program_students(id) ON DELETE CASCADE,
  faculty_id TEXT REFERENCES public.student_program_faculties(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_program_events_student
  ON public.student_program_events (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_program_events_faculty
  ON public.student_program_events (faculty_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_program_events_type_time
  ON public.student_program_events (type, created_at DESC);

-- ── updated_at ────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS tr_student_program_faculties_set_updated_at ON public.student_program_faculties;
CREATE TRIGGER tr_student_program_faculties_set_updated_at
  BEFORE UPDATE ON public.student_program_faculties
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

DROP TRIGGER IF EXISTS tr_student_program_faculty_contacts_set_updated_at ON public.student_program_faculty_contacts;
CREATE TRIGGER tr_student_program_faculty_contacts_set_updated_at
  BEFORE UPDATE ON public.student_program_faculty_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

DROP TRIGGER IF EXISTS tr_student_program_students_set_updated_at ON public.student_program_students;
CREATE TRIGGER tr_student_program_students_set_updated_at
  BEFORE UPDATE ON public.student_program_students
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- ── RLS: staff čte, zapisuje jen service_role ─────────────────────────────────

DO $rls$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'student_program_faculties',
    'student_program_faculty_contacts',
    'student_program_students',
    'student_program_events'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_staff', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_staff_email())',
      t || '_select_staff',
      t
    );
  END LOOP;
END
$rls$;

GRANT USAGE, SELECT ON SEQUENCE public.student_program_events_id_seq TO service_role;

-- ── pg_cron: denní běh studentského programu (check-iny, přechody stavů) ───────
-- Používá stejný secret jako mailing (app.mailing_cron_secret = MAILING_CRON_SECRET).

DO $student_cron$
DECLARE
  v_url TEXT := coalesce(
    nullif(current_setting('app.student_program_cron_url', true), ''),
    'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f/cron/student-program'
  );
  existing_job_id BIGINT;
  v_headers JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron není nainstalován — job student-program-daily přeskočen.';
    RETURN;
  END IF;

  SELECT jobid INTO existing_job_id FROM cron.job WHERE jobname = 'student-program-daily' LIMIT 1;
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  v_headers := jsonb_strip_nulls(
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', CASE
        WHEN nullif(current_setting('app.mailing_cron_secret', true), '') IS NOT NULL
        THEN 'Bearer ' || current_setting('app.mailing_cron_secret', true)
        ELSE NULL
      END,
      'x-cron-secret', nullif(current_setting('app.mailing_cron_secret', true), '')
    )
  );

  -- 07:10 UTC = 8:10 / 9:10 v ČR, mimo ranní špičku ostatních jobů.
  PERFORM cron.schedule(
    'student-program-daily',
    '10 7 * * *',
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
END
$student_cron$;
