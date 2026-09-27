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
