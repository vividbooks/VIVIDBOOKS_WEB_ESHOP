-- Odvozené skóre zájmu o předměty (tagy, pozice, merge fields) — počítá Edge job.

ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS subject_interest_scores JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.subscribers.subject_interest_scores IS 'Mapa slug předmětu → celé číslo skóre (např. {"fyzika":4,"chemie":2}). Počítá POST /admin/mailing/recompute-subject-interests.';
