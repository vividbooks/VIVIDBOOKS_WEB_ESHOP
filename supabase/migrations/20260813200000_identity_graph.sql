-- Graf identit (krok 1). Domov: web/mailing Postgres.
-- Osoba ≠ e-mail (1:N). IČO jen 8 číslic. Staff SELECT, zápis přes service_role.

-- ── helpery ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.identity_normalize_ico(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN regexp_replace(coalesce(raw, ''), '\D', '', 'g') ~ '^\d{8}$'
    THEN regexp_replace(raw, '\D', '', 'g')
    ELSE NULL
  END
$$;

COMMENT ON FUNCTION public.identity_normalize_ico IS
  'Vrátí 8 číslic nebo NULL. Mailchimp MMERGE6 sem nepatří, dokud neprojde.';

CREATE OR REPLACE FUNCTION public.identity_orgs_normalize()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.ico := public.identity_normalize_ico(NEW.ico);
  NEW.organization_code := nullif(upper(btrim(coalesce(NEW.organization_code, ''))), '');
  NEW.school_name := nullif(btrim(coalesce(NEW.school_name, '')), '');
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.identity_emails_normalize()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  IF NEW.email IS NULL OR NEW.email = '' OR position('@' in NEW.email) = 0 THEN
    RAISE EXCEPTION 'identity_emails.email must be a non-empty lowercased address';
  END IF;
  RETURN NEW;
END;
$$;

-- ── people ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.identity_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID,
  pd_person_id BIGINT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'unknown'
    CHECK (role IN (
      'teacher', 'director', 'deputy', 'parent', 'student',
      'homeschool', 'school_admin', 'other', 'unknown'
    )),
  subjects TEXT[] NOT NULL DEFAULT '{}'::text[]
    CHECK (subjects <@ ARRAY[
      'matematika', 'fyzika', 'chemie', 'prirodopis', 'prvouka', 'cesky-jazyk', 'other'
    ]::text[]),
  school_stages SMALLINT[] NOT NULL DEFAULT '{}'::smallint[]
    CHECK (school_stages <@ ARRAY[1, 2]::smallint[]),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_people_app_user_id_key
  ON public.identity_people (app_user_id)
  WHERE app_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS identity_people_pd_person_id_key
  ON public.identity_people (pd_person_id)
  WHERE pd_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS identity_people_name_idx
  ON public.identity_people (lower(last_name), lower(first_name));

CREATE INDEX IF NOT EXISTS identity_people_last_seen_idx
  ON public.identity_people (last_seen_at DESC NULLS LAST);

COMMENT ON TABLE public.identity_people IS
  'Kanonická osoba. Nemá unique e-mail — adresy jsou v identity_emails.';
COMMENT ON COLUMN public.identity_people.app_user_id IS
  'UUID z ultra auth.users.';
COMMENT ON COLUMN public.identity_people.pd_person_id IS
  'Pipedrive person id.';
COMMENT ON COLUMN public.identity_people.role IS
  'Kanonická role (SELECT / trial / PD 9093). Opt-in sem nepatří.';

DROP TRIGGER IF EXISTS tr_identity_people_set_updated_at ON public.identity_people;
CREATE TRIGGER tr_identity_people_set_updated_at
  BEFORE UPDATE ON public.identity_people
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

-- ── emails ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.identity_emails (
  email TEXT PRIMARY KEY
    CHECK (char_length(email) > 3 AND email = lower(trim(email))),
  person_id UUID NOT NULL REFERENCES public.identity_people(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES public.subscribers(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'other'
    CHECK (source IN (
      'mailchimp', 'webinar', 'checkout', 'app', 'pipedrive',
      'vb_id', 'trial', 'newsletter', 'other'
    )),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS identity_emails_person_id_idx
  ON public.identity_emails (person_id);

CREATE UNIQUE INDEX IF NOT EXISTS identity_emails_subscriber_id_key
  ON public.identity_emails (subscriber_id)
  WHERE subscriber_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS identity_emails_one_primary
  ON public.identity_emails (person_id)
  WHERE is_primary;

COMMENT ON TABLE public.identity_emails IS
  'Adresa osoby. Mailing opt-in zůstává na subscribers.status podle e-mailu.';

DROP TRIGGER IF EXISTS tr_identity_emails_normalize ON public.identity_emails;
CREATE TRIGGER tr_identity_emails_normalize
  BEFORE INSERT OR UPDATE ON public.identity_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.identity_emails_normalize();

-- ── orgs ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.identity_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ico TEXT
    CHECK (ico IS NULL OR ico ~ '^\d{8}$'),
  organization_code TEXT,
  pd_org_id BIGINT,
  school_name TEXT,
  pd_owner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT identity_orgs_has_key CHECK (
    ico IS NOT NULL
    OR (organization_code IS NOT NULL AND btrim(organization_code) <> '')
    OR pd_org_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_orgs_ico_key
  ON public.identity_orgs (ico)
  WHERE ico IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS identity_orgs_code_key
  ON public.identity_orgs (organization_code)
  WHERE organization_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS identity_orgs_pd_org_id_key
  ON public.identity_orgs (pd_org_id)
  WHERE pd_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS identity_orgs_school_name_idx
  ON public.identity_orgs (lower(school_name));

COMMENT ON TABLE public.identity_orgs IS
  'Škola. IČO jen 8 číslic z orders/trial/PD/handoff, ne z MMERGE6.';
COMMENT ON COLUMN public.identity_orgs.organization_code IS
  'Licenční kód školy v app (PASCAL), ne slot učitele.';

DROP TRIGGER IF EXISTS tr_identity_orgs_normalize ON public.identity_orgs;
CREATE TRIGGER tr_identity_orgs_normalize
  BEFORE INSERT OR UPDATE ON public.identity_orgs
  FOR EACH ROW
  EXECUTE FUNCTION public.identity_orgs_normalize();

-- ── memberships ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.identity_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.identity_people(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.identity_orgs(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'unknown'
    CHECK (role IN (
      'teacher', 'director', 'deputy', 'parent', 'student',
      'homeschool', 'school_admin', 'other', 'unknown'
    )),
  source TEXT NOT NULL DEFAULT 'other'
    CHECK (source IN (
      'app_login', 'webinar', 'checkout', 'pipedrive', 'trial', 'vb_id', 'other'
    )),
  external_teacher_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT identity_memberships_person_org_key UNIQUE (person_id, org_id)
);

CREATE INDEX IF NOT EXISTS identity_memberships_org_id_idx
  ON public.identity_memberships (org_id);

CREATE UNIQUE INDEX IF NOT EXISTS identity_memberships_org_slot_key
  ON public.identity_memberships (org_id, external_teacher_id)
  WHERE external_teacher_id IS NOT NULL AND btrim(external_teacher_id) <> '';

COMMENT ON TABLE public.identity_memberships IS
  'Osoba × škola. external_teacher_id = slot učitele ve škole, ne kód PASCAL.';
COMMENT ON COLUMN public.identity_memberships.external_teacher_id IS
  'Legacy teacher id z GET teachers. Unikátní jen v páru s org.';

-- ── identified web events ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.identity_web_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.identity_people(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  kind TEXT NOT NULL
    CHECK (kind IN ('subject', 'product', 'webinar', 'trial', 'other')),
  path TEXT,
  entity_id TEXT
);

CREATE INDEX IF NOT EXISTS identity_web_events_person_time_idx
  ON public.identity_web_events (person_id, occurred_at DESC);

COMMENT ON TABLE public.identity_web_events IS
  'Jen identifikované views (známý e-mail). Ne GA clone, ne auto-subscribe z vb_id.';

-- ── merge review (konflikty, žádný auto-merge) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.identity_merge_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  person_a_id UUID NOT NULL REFERENCES public.identity_people(id) ON DELETE CASCADE,
  person_b_id UUID NOT NULL REFERENCES public.identity_people(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'merged', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT identity_merge_review_distinct CHECK (person_a_id <> person_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_merge_review_open_key
  ON public.identity_merge_review (person_a_id, person_b_id)
  WHERE status = 'open';

COMMENT ON TABLE public.identity_merge_review IS
  'Konflikt slučování (e-mail vs app slot). Admin rozhodne — automat neslučuje.';

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.identity_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_web_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_merge_review ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS identity_people_select_staff ON public.identity_people;
CREATE POLICY identity_people_select_staff ON public.identity_people
  FOR SELECT TO authenticated USING (public.is_staff_email());

DROP POLICY IF EXISTS identity_emails_select_staff ON public.identity_emails;
CREATE POLICY identity_emails_select_staff ON public.identity_emails
  FOR SELECT TO authenticated USING (public.is_staff_email());

DROP POLICY IF EXISTS identity_orgs_select_staff ON public.identity_orgs;
CREATE POLICY identity_orgs_select_staff ON public.identity_orgs
  FOR SELECT TO authenticated USING (public.is_staff_email());

DROP POLICY IF EXISTS identity_memberships_select_staff ON public.identity_memberships;
CREATE POLICY identity_memberships_select_staff ON public.identity_memberships
  FOR SELECT TO authenticated USING (public.is_staff_email());

DROP POLICY IF EXISTS identity_web_events_select_staff ON public.identity_web_events;
CREATE POLICY identity_web_events_select_staff ON public.identity_web_events
  FOR SELECT TO authenticated USING (public.is_staff_email());

DROP POLICY IF EXISTS identity_merge_review_select_staff ON public.identity_merge_review;
CREATE POLICY identity_merge_review_select_staff ON public.identity_merge_review
  FOR SELECT TO authenticated USING (public.is_staff_email());

GRANT SELECT ON
  public.identity_people,
  public.identity_emails,
  public.identity_orgs,
  public.identity_memberships,
  public.identity_web_events,
  public.identity_merge_review
TO authenticated;

GRANT ALL ON
  public.identity_people,
  public.identity_emails,
  public.identity_orgs,
  public.identity_memberships,
  public.identity_web_events,
  public.identity_merge_review
TO service_role;

GRANT EXECUTE ON FUNCTION public.identity_normalize_ico(text) TO authenticated, service_role;
